import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { 
  users, branches, classes, students, parents, exams, 
  examDistributions, examAttempts, aiReports, studentParents, 
  studentClasses, distributionStudents 
} from "@shared/schema";
import { eq, and, desc, or, inArray, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, gradeExam } from "./utils/helpers";
import { requireAuth, requireAdmin, requireBranchManager, requireStudent, requireStudentOrParent } from "./middleware/auth";
import multer from "multer";
import * as XLSX from "xlsx";
import OpenAI from "openai";

const upload = multer({ storage: multer.memoryStorage() });

// OpenAI client for AI reports
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============ AUTH ROUTES ============
  
  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "아이디와 비밀번호를 입력해주세요." });
      }

      const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." });
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role as any,
        branchId: user.branchId || undefined,
      };

      res.json({ success: true, user: req.session.user });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "로그인 중 오류가 발생했습니다." });
    }
  });

  // Get current user
  app.get("/api/auth/me", (req, res) => {
    res.json({ success: true, user: req.session.user || null });
  });

  // Logout
  app.post("/api/auth/logout", requireAuth, (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "로그아웃 중 오류가 발생했습니다." });
      }
      res.json({ success: true, message: "로그아웃되었습니다." });
    });
  });

  // ============ BRANCH ROUTES ============
  
  // Get all branches (admin only)
  app.get("/api/branches", requireAdmin, async (req, res) => {
    try {
      const allBranches = await db.select().from(branches).orderBy(branches.displayOrder);
      res.json(allBranches);
    } catch (error) {
      console.error("Get branches error:", error);
      res.status(500).json({ message: "지점 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Create branch
  app.post("/api/branches", requireAdmin, async (req, res) => {
    try {
      const { name, address, phone, managerName } = req.body;
      const [branch] = await db.insert(branches).values({
        name,
        address,
        phone,
        managerName,
      }).returning();
      res.json(branch);
    } catch (error) {
      console.error("Create branch error:", error);
      res.status(500).json({ message: "지점 생성 중 오류가 발생했습니다." });
    }
  });

  // Update branch
  app.patch("/api/branches/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, address, phone, managerName, isActive, displayOrder } = req.body;
      const [branch] = await db.update(branches)
        .set({ name, address, phone, managerName, isActive, displayOrder, updatedAt: new Date() })
        .where(eq(branches.id, id))
        .returning();
      res.json(branch);
    } catch (error) {
      console.error("Update branch error:", error);
      res.status(500).json({ message: "지점 수정 중 오류가 발생했습니다." });
    }
  });

  // Delete branch
  app.delete("/api/branches/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(branches).where(eq(branches.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Delete branch error:", error);
      res.status(500).json({ message: "지점 삭제 중 오류가 발생했습니다." });
    }
  });

  // ============ USER MANAGEMENT ROUTES ============

  // Get all users (admin only)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        email: users.email,
        phone: users.phone,
        branchId: users.branchId,
        isActive: users.isActive,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "사용자 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Create user (admin or branch manager)
  app.post("/api/users", requireBranchManager, async (req, res) => {
    try {
      const { username, password, name, role, email, phone, branchId, school, grade, parentPhone } = req.body;
      
      // Check if username exists
      const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ message: "이미 존재하는 아이디입니다." });
      }

      const passwordHash = await hashPassword(password);
      const [user] = await db.insert(users).values({
        username,
        passwordHash,
        name,
        role,
        email,
        phone,
        branchId,
      }).returning();

      // If student, create student record
      if (role === "student" && branchId) {
        await db.insert(students).values({
          userId: user.id,
          branchId,
          school,
          grade,
          parentPhone,
        });
      }

      // If parent, create parent record
      if (role === "parent" && branchId) {
        await db.insert(parents).values({
          userId: user.id,
          branchId,
        });
      }

      res.json(user);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "사용자 생성 중 오류가 발생했습니다." });
    }
  });

  // Update user
  app.patch("/api/users/:id", requireBranchManager, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, isActive, password } = req.body;
      
      const updateData: any = { name, email, phone, isActive, updatedAt: new Date() };
      if (password) {
        updateData.passwordHash = await hashPassword(password);
      }
      
      const [user] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();
      res.json(user);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "사용자 수정 중 오류가 발생했습니다." });
    }
  });

  // ============ CLASS ROUTES ============

  // Get classes for branch
  app.get("/api/classes", requireBranchManager, async (req, res) => {
    try {
      const branchId = req.session.user?.branchId;
      const query = branchId 
        ? db.select().from(classes).where(eq(classes.branchId, branchId))
        : db.select().from(classes);
      const allClasses = await query.orderBy(classes.name);
      res.json(allClasses);
    } catch (error) {
      console.error("Get classes error:", error);
      res.status(500).json({ message: "반 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Create class
  app.post("/api/classes", requireBranchManager, async (req, res) => {
    try {
      const { name, branchId, grade, description } = req.body;
      const [newClass] = await db.insert(classes).values({
        name,
        branchId: branchId || req.session.user?.branchId,
        grade,
        description,
      }).returning();
      res.json(newClass);
    } catch (error) {
      console.error("Create class error:", error);
      res.status(500).json({ message: "반 생성 중 오류가 발생했습니다." });
    }
  });

  // ============ STUDENT ROUTES ============

  // Get students for branch
  app.get("/api/students", requireBranchManager, async (req, res) => {
    try {
      const branchId = req.session.user?.branchId;
      const studentList = await db.select({
        student: students,
        user: {
          id: users.id,
          username: users.username,
          name: users.name,
          email: users.email,
          phone: users.phone,
          isActive: users.isActive,
        },
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .where(branchId ? eq(students.branchId, branchId) : sql`1=1`)
      .orderBy(users.name);
      
      res.json(studentList.map(s => ({ ...s.student, user: s.user })));
    } catch (error) {
      console.error("Get students error:", error);
      res.status(500).json({ message: "학생 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Get student by user ID (for student dashboard)
  app.get("/api/students/me", requireStudent, async (req, res) => {
    try {
      const userId = req.session.user?.id;
      const [student] = await db.select()
        .from(students)
        .where(eq(students.userId, userId!))
        .limit(1);
      res.json(student);
    } catch (error) {
      console.error("Get student error:", error);
      res.status(500).json({ message: "학생 정보를 불러오는 중 오류가 발생했습니다." });
    }
  });

  // ============ EXAM ROUTES ============

  // Get exams (admin sees all, branch manager sees distributed)
  app.get("/api/exams", requireBranchManager, async (req, res) => {
    try {
      const examList = await db.select().from(exams).orderBy(desc(exams.createdAt));
      res.json(examList);
    } catch (error) {
      console.error("Get exams error:", error);
      res.status(500).json({ message: "시험 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Create exam with Excel upload
  app.post("/api/exams", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const { title, subject, grade, description } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "엑셀 파일을 업로드해주세요." });
      }

      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet) as any[];

      // Parse questions from Excel
      const questionsData = data.map((row, index) => ({
        questionNumber: row["문항번호"] || index + 1,
        correctAnswer: Number(row["정답"]) || 1,
        score: Number(row["배점"]) || 1,
        topic: row["단원"] || "",
        concept: row["개념"] || "",
        difficulty: row["난이도"] || "중",
      }));

      const totalQuestions = questionsData.length;
      const totalScore = questionsData.reduce((sum, q) => sum + q.score, 0);

      const [exam] = await db.insert(exams).values({
        title,
        subject,
        grade,
        description,
        totalQuestions,
        totalScore,
        questionsData,
        createdBy: req.session.user!.id,
      }).returning();

      res.json(exam);
    } catch (error) {
      console.error("Create exam error:", error);
      res.status(500).json({ message: "시험 생성 중 오류가 발생했습니다." });
    }
  });

  // Get exam by ID
  app.get("/api/exams/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [exam] = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
      if (!exam) {
        return res.status(404).json({ message: "시험을 찾을 수 없습니다." });
      }
      res.json(exam);
    } catch (error) {
      console.error("Get exam error:", error);
      res.status(500).json({ message: "시험 정보를 불러오는 중 오류가 발생했습니다." });
    }
  });

  // ============ EXAM DISTRIBUTION ROUTES ============

  // Distribute exam to branch
  app.post("/api/exams/:examId/distribute", requireAdmin, async (req, res) => {
    try {
      const { examId } = req.params;
      const { branchId, startDate, endDate } = req.body;

      const [distribution] = await db.insert(examDistributions).values({
        examId,
        branchId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        distributedBy: req.session.user!.id,
      }).returning();

      res.json(distribution);
    } catch (error) {
      console.error("Distribute exam error:", error);
      res.status(500).json({ message: "시험 배포 중 오류가 발생했습니다." });
    }
  });

  // Branch manager distribute to class/students
  app.post("/api/distributions/:distributionId/assign", requireBranchManager, async (req, res) => {
    try {
      const { distributionId } = req.params;
      const { classId, studentIds, startDate, endDate } = req.body;

      const [newDist] = await db.insert(examDistributions).values({
        examId: (await db.select().from(examDistributions).where(eq(examDistributions.id, distributionId)).limit(1))[0].examId,
        branchId: req.session.user!.branchId!,
        classId,
        parentDistributionId: distributionId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        distributedBy: req.session.user!.id,
      }).returning();

      // Add specific students if provided
      if (studentIds && studentIds.length > 0) {
        await db.insert(distributionStudents).values(
          studentIds.map((studentId: string) => ({
            distributionId: newDist.id,
            studentId,
          }))
        );
      }

      res.json(newDist);
    } catch (error) {
      console.error("Assign exam error:", error);
      res.status(500).json({ message: "시험 배정 중 오류가 발생했습니다." });
    }
  });

  // Get distributions for branch
  app.get("/api/distributions", requireBranchManager, async (req, res) => {
    try {
      const branchId = req.session.user?.branchId;
      const distributions = await db.select({
        distribution: examDistributions,
        exam: {
          id: exams.id,
          title: exams.title,
          subject: exams.subject,
          grade: exams.grade,
          totalQuestions: exams.totalQuestions,
        },
      })
      .from(examDistributions)
      .innerJoin(exams, eq(examDistributions.examId, exams.id))
      .where(branchId ? eq(examDistributions.branchId, branchId) : sql`1=1`)
      .orderBy(desc(examDistributions.createdAt));

      res.json(distributions.map(d => ({ ...d.distribution, exam: d.exam })));
    } catch (error) {
      console.error("Get distributions error:", error);
      res.status(500).json({ message: "배포 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // ============ EXAM ATTEMPT ROUTES ============

  // Get available exams for student
  app.get("/api/student/exams", requireStudent, async (req, res) => {
    try {
      const userId = req.session.user?.id;
      const [student] = await db.select().from(students).where(eq(students.userId, userId!)).limit(1);
      
      if (!student) {
        return res.status(404).json({ message: "학생 정보를 찾을 수 없습니다." });
      }

      const now = new Date();
      
      // Get distributions for student's branch
      const distributions = await db.select({
        distribution: examDistributions,
        exam: exams,
      })
      .from(examDistributions)
      .innerJoin(exams, eq(examDistributions.examId, exams.id))
      .where(and(
        eq(examDistributions.branchId, student.branchId),
        sql`${examDistributions.startDate} <= ${now}`,
        sql`${examDistributions.endDate} >= ${now}`
      ));

      // Get attempts for this student
      const attempts = await db.select().from(examAttempts).where(eq(examAttempts.studentId, student.id));
      const attemptedExamIds = new Set(attempts.map(a => a.examId));

      const availableExams = distributions.map(d => ({
        ...d.distribution,
        exam: d.exam,
        attempted: attemptedExamIds.has(d.exam.id),
        attempt: attempts.find(a => a.examId === d.exam.id),
      }));

      res.json(availableExams);
    } catch (error) {
      console.error("Get student exams error:", error);
      res.status(500).json({ message: "시험 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Submit exam answers
  app.post("/api/exams/:examId/submit", requireStudent, async (req, res) => {
    try {
      const { examId } = req.params;
      const { distributionId, answers } = req.body;
      const userId = req.session.user?.id;

      const [student] = await db.select().from(students).where(eq(students.userId, userId!)).limit(1);
      if (!student) {
        return res.status(404).json({ message: "학생 정보를 찾을 수 없습니다." });
      }

      // Check if already submitted
      const existing = await db.select().from(examAttempts).where(
        and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, student.id))
      ).limit(1);
      
      if (existing.length > 0 && existing[0].submittedAt) {
        return res.status(400).json({ message: "이미 제출한 시험입니다." });
      }

      // Get exam data for grading
      const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
      if (!exam) {
        return res.status(404).json({ message: "시험을 찾을 수 없습니다." });
      }

      // Grade the exam
      const gradeResult = gradeExam(answers, exam.questionsData as any[]);

      // Create or update attempt
      const [attempt] = existing.length > 0
        ? await db.update(examAttempts)
            .set({
              answers,
              score: gradeResult.score,
              maxScore: gradeResult.maxScore,
              correctCount: gradeResult.correctCount,
              grade: gradeResult.grade,
              submittedAt: new Date(),
              gradedAt: new Date(),
            })
            .where(eq(examAttempts.id, existing[0].id))
            .returning()
        : await db.insert(examAttempts).values({
            examId,
            studentId: student.id,
            distributionId,
            answers,
            score: gradeResult.score,
            maxScore: gradeResult.maxScore,
            correctCount: gradeResult.correctCount,
            grade: gradeResult.grade,
            submittedAt: new Date(),
            gradedAt: new Date(),
          }).returning();

      res.json(attempt);
    } catch (error) {
      console.error("Submit exam error:", error);
      res.status(500).json({ message: "시험 제출 중 오류가 발생했습니다." });
    }
  });

  // Get student's exam results
  app.get("/api/student/results", requireStudentOrParent, async (req, res) => {
    try {
      const userId = req.session.user?.id;
      const role = req.session.user?.role;
      
      let studentId: string;
      
      if (role === "student") {
        const [student] = await db.select().from(students).where(eq(students.userId, userId!)).limit(1);
        studentId = student.id;
      } else {
        // Parent - get linked students
        const { studentId: reqStudentId } = req.query;
        studentId = reqStudentId as string;
      }

      const results = await db.select({
        attempt: examAttempts,
        exam: {
          id: exams.id,
          title: exams.title,
          subject: exams.subject,
          grade: exams.grade,
          totalQuestions: exams.totalQuestions,
          totalScore: exams.totalScore,
        },
        report: aiReports,
      })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.id))
      .leftJoin(aiReports, eq(examAttempts.id, aiReports.attemptId))
      .where(eq(examAttempts.studentId, studentId))
      .orderBy(desc(examAttempts.submittedAt));

      res.json(results.map(r => ({
        ...r.attempt,
        exam: r.exam,
        report: r.report,
      })));
    } catch (error) {
      console.error("Get results error:", error);
      res.status(500).json({ message: "성적 결과를 불러오는 중 오류가 발생했습니다." });
    }
  });

  // ============ AI REPORT ROUTES ============

  // Generate AI report for attempt
  app.post("/api/reports/generate/:attemptId", requireBranchManager, async (req, res) => {
    try {
      const { attemptId } = req.params;

      // Get attempt with exam and student data
      const [attemptData] = await db.select({
        attempt: examAttempts,
        exam: exams,
        student: students,
        user: users,
      })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.id))
      .innerJoin(students, eq(examAttempts.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(eq(examAttempts.id, attemptId))
      .limit(1);

      if (!attemptData) {
        return res.status(404).json({ message: "응시 정보를 찾을 수 없습니다." });
      }

      const { attempt, exam, student, user } = attemptData;
      const questionsData = exam.questionsData as any[];
      const studentAnswers = attempt.answers as Record<string, number>;

      // Analyze wrong answers
      const wrongAnswers = questionsData.filter(q => 
        studentAnswers[String(q.questionNumber)] !== q.correctAnswer
      );

      // Generate AI analysis
      const prompt = `
한국 수능/학력평가 분석 전문가로서 학생의 시험 결과를 분석해주세요.

학생 정보:
- 이름: ${user.name}
- 학년: ${student.grade || "고등학생"}

시험 정보:
- 시험명: ${exam.title}
- 과목: ${exam.subject}
- 총 문항수: ${exam.totalQuestions}
- 총점: ${exam.totalScore}

학생 성적:
- 득점: ${attempt.score}/${attempt.maxScore}
- 정답률: ${((attempt.correctCount || 0) / exam.totalQuestions * 100).toFixed(1)}%
- 등급: ${attempt.grade}등급

틀린 문제 분석:
${wrongAnswers.map(q => `- ${q.questionNumber}번: 정답 ${q.correctAnswer}번, 학생답안 ${studentAnswers[String(q.questionNumber)] || "무응답"} (단원: ${q.topic}, 개념: ${q.concept}, 난이도: ${q.difficulty})`).join("\n")}

다음 형식으로 JSON 응답해주세요:
{
  "summary": "전체 성적 요약 (2-3문장)",
  "weakAreas": ["취약 단원/개념 목록"],
  "recommendations": ["구체적인 학습 추천 사항 (3-5개)"],
  "expectedGrade": "다음 시험 예상 등급 (1-9)",
  "analysis": {
    "strengths": ["잘한 점"],
    "improvements": ["개선 필요 사항"],
    "studyPlan": "추천 학습 계획"
  }
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "당신은 한국 교육 전문가입니다. 학생들의 시험 결과를 분석하고 맞춤형 학습 조언을 제공합니다." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      const analysisText = completion.choices[0]?.message?.content || "{}";
      const analysis = JSON.parse(analysisText);

      // Create HTML report
      const htmlContent = `
<div class="ai-report">
  <h2>${user.name} 학생 성적 분석 리포트</h2>
  <div class="summary">
    <h3>성적 요약</h3>
    <p>${analysis.summary}</p>
    <div class="grade-info">
      <span>득점: ${attempt.score}/${attempt.maxScore}</span>
      <span>등급: ${attempt.grade}등급</span>
      <span>예상 등급: ${analysis.expectedGrade}등급</span>
    </div>
  </div>
  <div class="weak-areas">
    <h3>취약 영역</h3>
    <ul>${(analysis.weakAreas || []).map((a: string) => `<li>${a}</li>`).join("")}</ul>
  </div>
  <div class="recommendations">
    <h3>학습 추천</h3>
    <ul>${(analysis.recommendations || []).map((r: string) => `<li>${r}</li>`).join("")}</ul>
  </div>
</div>`;

      // Save report
      const [report] = await db.insert(aiReports).values({
        attemptId,
        studentId: student.id,
        examId: exam.id,
        analysis,
        weakAreas: analysis.weakAreas,
        recommendations: analysis.recommendations,
        expectedGrade: parseInt(analysis.expectedGrade) || attempt.grade,
        summary: analysis.summary,
        htmlContent,
      }).returning();

      res.json(report);
    } catch (error) {
      console.error("Generate report error:", error);
      res.status(500).json({ message: "AI 리포트 생성 중 오류가 발생했습니다." });
    }
  });

  // Get AI report
  app.get("/api/reports/:attemptId", requireAuth, async (req, res) => {
    try {
      const { attemptId } = req.params;
      const [report] = await db.select().from(aiReports).where(eq(aiReports.attemptId, attemptId)).limit(1);
      
      if (!report) {
        return res.status(404).json({ message: "리포트를 찾을 수 없습니다." });
      }
      res.json(report);
    } catch (error) {
      console.error("Get report error:", error);
      res.status(500).json({ message: "리포트를 불러오는 중 오류가 발생했습니다." });
    }
  });

  // ============ DASHBOARD STATS ============

  // Admin dashboard stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const [branchCount] = await db.select({ count: sql<number>`count(*)` }).from(branches);
      const [studentCount] = await db.select({ count: sql<number>`count(*)` }).from(students);
      const [examCount] = await db.select({ count: sql<number>`count(*)` }).from(exams);
      const [attemptCount] = await db.select({ count: sql<number>`count(*)` }).from(examAttempts);

      res.json({
        branches: Number(branchCount.count),
        students: Number(studentCount.count),
        exams: Number(examCount.count),
        attempts: Number(attemptCount.count),
      });
    } catch (error) {
      console.error("Get admin stats error:", error);
      res.status(500).json({ message: "통계를 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Branch dashboard stats
  app.get("/api/branch/stats", requireBranchManager, async (req, res) => {
    try {
      const branchId = req.session.user?.branchId;
      
      const [studentCount] = await db.select({ count: sql<number>`count(*)` })
        .from(students)
        .where(eq(students.branchId, branchId!));
      
      const [classCount] = await db.select({ count: sql<number>`count(*)` })
        .from(classes)
        .where(eq(classes.branchId, branchId!));
      
      const [distCount] = await db.select({ count: sql<number>`count(*)` })
        .from(examDistributions)
        .where(eq(examDistributions.branchId, branchId!));

      res.json({
        students: Number(studentCount.count),
        classes: Number(classCount.count),
        distributions: Number(distCount.count),
      });
    } catch (error) {
      console.error("Get branch stats error:", error);
      res.status(500).json({ message: "통계를 불러오는 중 오류가 발생했습니다." });
    }
  });

  // ============ INIT ADMIN ============
  
  // Create initial admin (only if no admin exists)
  app.post("/api/init", async (req, res) => {
    try {
      const existingAdmin = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
      if (existingAdmin.length > 0) {
        return res.status(400).json({ message: "관리자가 이미 존재합니다." });
      }

      const passwordHash = await hashPassword("admin123");
      const [admin] = await db.insert(users).values({
        username: "admin",
        passwordHash,
        name: "시스템 관리자",
        role: "admin",
      }).returning();

      res.json({ success: true, message: "관리자 계정이 생성되었습니다.", user: { username: admin.username } });
    } catch (error) {
      console.error("Init admin error:", error);
      res.status(500).json({ message: "관리자 생성 중 오류가 발생했습니다." });
    }
  });

  return httpServer;
}
