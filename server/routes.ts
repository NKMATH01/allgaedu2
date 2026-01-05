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
import { GoogleGenerativeAI } from "@google/generative-ai";
import { OLGA_REPORT_META_PROMPT_V2 } from "./prompts/olga-report-meta-prompt-v2";
import { generateReportHTML } from "./templates/newReportTemplate";

const upload = multer({ storage: multer.memoryStorage() });

// Google Gemini AI client for AI reports
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============ AUTH ROUTES ============
  
  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password, userType } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "아이디와 비밀번호를 입력해주세요." });
      }

      // Find user by username, optionally filter by role if userType specified
      let query = db.select().from(users).where(eq(users.username, username));
      const [user] = await query.limit(1);
      
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." });
      }

      // If userType specified and not 'auto', verify role matches
      if (userType && userType !== 'auto' && user.role !== userType) {
        return res.status(401).json({ message: "선택한 계정 유형과 일치하지 않습니다." });
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

  // Impersonate branch manager (admin only)
  app.post("/api/auth/impersonate/:branchId", requireAdmin, async (req, res) => {
    try {
      const { branchId } = req.params;
      
      // Find branch manager for this branch
      const [branchManager] = await db.select()
        .from(users)
        .where(and(
          eq(users.role, "branch"),
          eq(users.branchId, branchId)
        ))
        .limit(1);

      if (!branchManager) {
        return res.status(404).json({ message: "해당 지점의 관리자를 찾을 수 없습니다." });
      }

      // Store original admin user for later
      const originalAdmin = req.session.user;

      // Switch to branch manager
      req.session.user = {
        id: branchManager.id,
        username: branchManager.username,
        name: branchManager.name,
        role: branchManager.role as any,
        branchId: branchManager.branchId || undefined,
      };
      req.session.originalAdmin = originalAdmin;

      res.json({ success: true, user: req.session.user, message: `${branchManager.name}으로 전환되었습니다.` });
    } catch (error) {
      console.error("Impersonate error:", error);
      res.status(500).json({ message: "지점 관리자로 전환 중 오류가 발생했습니다." });
    }
  });

  // Return to admin (after impersonating)
  app.post("/api/auth/return-to-admin", requireAuth, (req, res) => {
    try {
      if (!req.session.originalAdmin) {
        return res.status(400).json({ message: "원래 관리자 정보가 없습니다." });
      }

      req.session.user = req.session.originalAdmin;
      delete req.session.originalAdmin;

      res.json({ success: true, user: req.session.user, message: "관리자로 복귀했습니다." });
    } catch (error) {
      console.error("Return to admin error:", error);
      res.status(500).json({ message: "관리자로 복귀 중 오류가 발생했습니다." });
    }
  });

  // ============ BRANCH ROUTES ============
  
  // Get all branches (admin only)
  app.get("/api/branches", requireAdmin, async (req, res) => {
    try {
      const allBranches = await db.select().from(branches).orderBy(branches.displayOrder);
      res.json({ data: allBranches });
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
      res.json({ success: true, data: branch });
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
      res.json({ success: true, data: branch });
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

  // PUT route for branch update (GitHub compatibility)
  app.put("/api/branches/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, address, phone, managerName } = req.body;
      const [branch] = await db.update(branches)
        .set({ name, address, phone, managerName, updatedAt: new Date() })
        .where(eq(branches.id, id))
        .returning();
      res.json({ success: true, data: branch, message: "지점이 수정되었습니다." });
    } catch (error) {
      console.error("Update branch error:", error);
      res.status(500).json({ message: "지점 수정 중 오류가 발생했습니다." });
    }
  });

  // Reorder branches
  app.post("/api/branches/reorder", requireAdmin, async (req, res) => {
    try {
      const { branchIds } = req.body;
      if (!Array.isArray(branchIds) || branchIds.length === 0) {
        return res.status(400).json({ message: "유효한 지점 순서를 입력해주세요." });
      }
      await Promise.all(
        branchIds.map((id, index) =>
          db.update(branches).set({ displayOrder: index }).where(eq(branches.id, id))
        )
      );
      res.json({ success: true, message: "지점 순서가 변경되었습니다." });
    } catch (error) {
      console.error("Reorder branches error:", error);
      res.status(500).json({ message: "지점 순서 변경 중 오류가 발생했습니다." });
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

  // ============ CLASS ROUTES (GitHub exact format) ============

  // Get classes for branch
  app.get("/api/classes", requireBranchManager, async (req, res) => {
    try {
      const branchId = req.session.user?.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "지점 정보가 없습니다." });
      }
      const classList = await db.select().from(classes)
        .where(eq(classes.branchId, branchId))
        .orderBy(classes.createdAt);
      
      // Get studentIds for each class
      const classesWithStudents = await Promise.all(
        classList.map(async (cls) => {
          const classStudents = await db.select({ studentId: studentClasses.studentId })
            .from(studentClasses)
            .where(eq(studentClasses.classId, cls.id));
          return {
            ...cls,
            studentIds: classStudents.map(cs => cs.studentId),
          };
        })
      );
      
      res.json({ success: true, data: classesWithStudents });
    } catch (error) {
      console.error("Get classes error:", error);
      res.status(500).json({ message: "반 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Create class
  app.post("/api/classes", requireBranchManager, async (req, res) => {
    try {
      const branchId = req.session.user?.branchId;
      const { name, grade, description, studentIds } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "반 이름을 입력해주세요." });
      }
      
      const [newClass] = await db.insert(classes).values({
        name,
        branchId: branchId!,
        grade,
        description,
      }).returning();
      
      // If studentIds provided, assign students to class
      if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
        for (const studentId of studentIds) {
          await db.insert(studentClasses).values({
            studentId,
            classId: newClass.id,
          }).onConflictDoNothing();
        }
      }
      
      res.status(201).json({ success: true, data: newClass, message: "반이 생성되었습니다." });
    } catch (error) {
      console.error("Create class error:", error);
      res.status(500).json({ message: "반 생성 중 오류가 발생했습니다." });
    }
  });

  // Update class
  app.put("/api/classes/:id", requireBranchManager, async (req, res) => {
    try {
      const { id } = req.params;
      const branchId = req.session.user?.branchId;
      const { name, grade, description, studentIds } = req.body;
      
      const [updatedClass] = await db.update(classes)
        .set({ name, grade, description })
        .where(and(eq(classes.id, id), eq(classes.branchId, branchId!)))
        .returning();
      
      if (!updatedClass) {
        return res.status(404).json({ message: "반을 찾을 수 없습니다." });
      }
      
      // Update student assignments if provided
      if (studentIds && Array.isArray(studentIds)) {
        // Remove existing assignments
        await db.delete(studentClasses).where(eq(studentClasses.classId, id));
        // Add new assignments
        for (const studentId of studentIds) {
          await db.insert(studentClasses).values({
            studentId,
            classId: id,
          }).onConflictDoNothing();
        }
      }
      
      res.json({ success: true, data: updatedClass, message: "반이 수정되었습니다." });
    } catch (error) {
      console.error("Update class error:", error);
      res.status(500).json({ message: "반 수정 중 오류가 발생했습니다." });
    }
  });

  // Delete class
  app.delete("/api/classes/:id", requireBranchManager, async (req, res) => {
    try {
      const { id } = req.params;
      const branchId = req.session.user?.branchId;
      
      await db.delete(studentClasses).where(eq(studentClasses.classId, id));
      await db.delete(classes).where(and(eq(classes.id, id), eq(classes.branchId, branchId!)));
      
      res.json({ success: true, message: "반이 삭제되었습니다." });
    } catch (error) {
      console.error("Delete class error:", error);
      res.status(500).json({ message: "반 삭제 중 오류가 발생했습니다." });
    }
  });

  // ============ STUDENT ROUTES (GitHub exact format) ============

  // Get students for branch
  app.get("/api/students", requireBranchManager, async (req, res) => {
    try {
      const branchId = req.session.user?.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "지점 정보가 없습니다." });
      }
      
      const studentList = await db.select({
        student: students,
        user: users,
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .where(eq(students.branchId, branchId))
      .orderBy(students.enrollmentDate);
      
      const result = studentList.map(s => ({
        ...s.student,
        user: {
          id: s.user.id,
          username: s.user.username,
          name: s.user.name,
          phone: s.user.phone,
          email: s.user.email,
          isActive: s.user.isActive,
        },
      }));
      
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Get students error:", error);
      res.status(500).json({ message: "학생 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Create student (GitHub exact: phone as username, last 4 digits as password)
  app.post("/api/students", requireBranchManager, async (req, res) => {
    try {
      const branchId = req.session.user?.branchId;
      const { name, phone, school, grade, parentPhone } = req.body;
      
      if (!name || !phone) {
        return res.status(400).json({ message: "필수 정보를 모두 입력해주세요." });
      }
      
      if (phone.length < 4) {
        return res.status(400).json({ message: "연락처는 최소 4자리 이상이어야 합니다." });
      }
      
      // Use phone as username
      const username = phone;
      
      // Check if username exists
      const [existingUser] = await db.select().from(users)
        .where(eq(users.username, username)).limit(1);
      
      if (existingUser) {
        return res.status(400).json({ message: "이미 사용 중인 연락처입니다." });
      }
      
      // Generate password from last 4 digits of phone
      const password = phone.slice(-4);
      const passwordHash = await hashPassword(password);
      
      // Create user
      const [user] = await db.insert(users).values({
        username,
        passwordHash,
        role: "student",
        name,
        phone,
        branchId,
      }).returning();
      
      // Create student
      const [student] = await db.insert(students).values({
        userId: user.id,
        branchId: branchId!,
        school,
        grade,
        parentPhone,
      }).returning();
      
      res.status(201).json({
        success: true,
        data: { ...student, user },
        message: "학생이 등록되었습니다. (초기 비밀번호: 연락처 끝 4자리)",
      });
    } catch (error) {
      console.error("Create student error:", error);
      res.status(500).json({ message: "학생 등록 중 오류가 발생했습니다." });
    }
  });

  // Update student (PUT method for GitHub compatibility)
  app.put("/api/students/:id", requireBranchManager, async (req, res) => {
    try {
      const { id } = req.params;
      const branchId = req.session.user?.branchId;
      const { name, phone, school, grade, parentPhone, password } = req.body;
      
      // Get student
      const [student] = await db.select().from(students)
        .where(and(eq(students.id, id), eq(students.branchId, branchId!)))
        .limit(1);
      
      if (!student) {
        return res.status(404).json({ message: "학생을 찾을 수 없습니다." });
      }
      
      // Update user
      const userUpdate: any = { name };
      if (phone) {
        userUpdate.phone = phone;
        userUpdate.username = phone; // phone is username
      }
      if (password) {
        userUpdate.passwordHash = await hashPassword(password);
      }
      
      await db.update(users).set(userUpdate).where(eq(users.id, student.userId));
      
      // Update student
      const [updatedStudent] = await db.update(students)
        .set({ school, grade, parentPhone })
        .where(eq(students.id, id))
        .returning();
      
      res.json({
        success: true,
        data: updatedStudent,
        message: password ? "학생 정보가 수정되었습니다. (비밀번호 변경됨)" : "학생 정보가 수정되었습니다.",
      });
    } catch (error) {
      console.error("Update student error:", error);
      res.status(500).json({ message: "학생 수정 중 오류가 발생했습니다." });
    }
  });

  // Delete student
  app.delete("/api/students/:id", requireBranchManager, async (req, res) => {
    try {
      const { id } = req.params;
      const branchId = req.session.user?.branchId;
      
      const [student] = await db.select().from(students)
        .where(and(eq(students.id, id), eq(students.branchId, branchId!)))
        .limit(1);
      
      if (!student) {
        return res.status(404).json({ message: "학생을 찾을 수 없습니다." });
      }
      
      // Delete related records
      await db.delete(studentClasses).where(eq(studentClasses.studentId, id));
      await db.delete(students).where(eq(students.id, id));
      await db.delete(users).where(eq(users.id, student.userId));
      
      res.json({ success: true, message: "학생이 삭제되었습니다." });
    } catch (error) {
      console.error("Delete student error:", error);
      res.status(500).json({ message: "학생 삭제 중 오류가 발생했습니다." });
    }
  });

  // Get student by user ID (for student dashboard)
  app.get("/api/students/me", requireStudent, async (req, res) => {
    try {
      const userId = req.session.user?.id;
      const [studentData] = await db.select({
        student: students,
        user: users,
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .where(eq(students.userId, userId!))
      .limit(1);
      
      if (!studentData) {
        return res.status(404).json({ message: "학생 정보를 찾을 수 없습니다." });
      }
      
      res.json({ success: true, data: { ...studentData.student, user: studentData.user } });
    } catch (error) {
      console.error("Get student error:", error);
      res.status(500).json({ message: "학생 정보를 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Branch stats endpoint
  app.get("/api/branch-students/stats", requireBranchManager, async (req, res) => {
    try {
      const branchId = req.session.user?.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "지점 정보가 없습니다." });
      }
      
      const [studentCount] = await db.select({ count: sql<number>`count(*)` })
        .from(students).where(eq(students.branchId, branchId));
      const [classCount] = await db.select({ count: sql<number>`count(*)` })
        .from(classes).where(eq(classes.branchId, branchId));
      const [distCount] = await db.select({ count: sql<number>`count(*)` })
        .from(examDistributions).where(eq(examDistributions.branchId, branchId));
      
      res.json({
        success: true,
        data: {
          totalStudents: Number(studentCount.count) || 0,
          totalClasses: Number(classCount.count) || 0,
          totalDistributions: Number(distCount.count) || 0,
        },
      });
    } catch (error) {
      console.error("Get branch stats error:", error);
      res.status(500).json({ message: "통계를 불러오는 중 오류가 발생했습니다." });
    }
  });

  // ============ EXAM ROUTES ============

  // Get exams (admin sees all, branch manager sees distributed)
  app.get("/api/exams", requireBranchManager, async (req, res) => {
    try {
      const examList = await db.select().from(exams).orderBy(desc(exams.createdAt));
      res.json({ data: examList });
    } catch (error) {
      console.error("Get exams error:", error);
      res.status(500).json({ message: "시험 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Create exam manually (JSON body)
  app.post("/api/exams", requireAdmin, async (req, res) => {
    try {
      const { title, subject, grade, description, totalQuestions: tq, questionsData: qd } = req.body;

      const totalQuestions = tq || 20;
      
      // Generate default questions if not provided
      const questionsData = qd || Array.from({ length: totalQuestions }, (_, i) => ({
        questionNumber: i + 1,
        correctAnswer: ((i % 5) + 1),
        score: 2,
        topic: "",
        concept: "",
        difficulty: "중",
      }));

      const totalScore = questionsData.reduce((sum: number, q: any) => sum + (q.score || q.points || 2), 0);

      const [exam] = await db.insert(exams).values({
        title,
        subject: subject || "국어",
        grade,
        description: description || "",
        totalQuestions,
        totalScore,
        questionsData,
        createdBy: req.session.user!.id,
      }).returning();

      res.json({ success: true, data: exam, message: "시험이 생성되었습니다." });
    } catch (error) {
      console.error("Create exam error:", error);
      res.status(500).json({ message: "시험 생성 중 오류가 발생했습니다." });
    }
  });

  // Create exam with Excel upload (EXACT copy from GitHub)
  app.post("/api/exams/upload", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Excel 파일을 업로드해주세요." });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Extract metadata from first rows
      const title = data[0]?.[0] || "제목 없음";
      const subject = data[1]?.[0] || "과목 미지정";

      // Parse questions data (starting from row 4, index 3)
      // Column structure: 번호, 난이도, 출제영역, 유형분석, 소분류, 해설, 정답, 배점
      const questionsData: any[] = [];
      const seenQuestionNumbers = new Set<number>();

      for (let i = 3; i < data.length && i < 100; i++) {
        const row = data[i];
        if (!row || !row[0]) continue;

        const questionNumber = parseInt(String(row[0]));
        if (isNaN(questionNumber)) continue;

        // Skip duplicates (keep last occurrence)
        if (seenQuestionNumbers.has(questionNumber)) {
          const existingIndex = questionsData.findIndex((q) => q.number === questionNumber);
          if (existingIndex >= 0) {
            questionsData.splice(existingIndex, 1);
          }
        }
        seenQuestionNumbers.add(questionNumber);

        const difficulty = row[1] || "중";
        const domain = row[2] || "미분류";
        const typeAnalysis = row[3] || "";
        const subcategory = row[4] || "";
        const explanation = row[5] || "";
        const correctAnswer = parseInt(String(row[6]));
        const points = parseInt(String(row[7])) || 2;

        if (isNaN(correctAnswer) || isNaN(points)) {
          continue;
        }

        questionsData.push({
          number: questionNumber,
          questionNumber,
          difficulty: String(difficulty),
          domain: String(domain),
          category: String(domain),
          typeAnalysis: String(typeAnalysis),
          questionIntent: String(typeAnalysis),
          subcategory: String(subcategory),
          explanation: String(explanation),
          correctAnswer,
          score: points,
          points,
        });
      }

      if (questionsData.length === 0) {
        return res.status(400).json({ message: "문제 데이터를 찾을 수 없습니다." });
      }

      // Calculate total score
      const totalScore = questionsData.reduce((sum, q) => sum + q.points, 0);

      // Parse exam trends (rows 50-52, index 49-51)
      const examTrends: any[] = [];
      for (let i = 49; i < 52 && i < data.length; i++) {
        const row = data[i];
        if (row && row[0] && row[1]) {
          examTrends.push({
            questionNumbers: String(row[0]),
            description: String(row[1]),
          });
        }
      }

      // Parse overall review (row 54, index 53)
      const overallReview = data[53]?.[0] || "";

      // Insert exam into database
      const [exam] = await db
        .insert(exams)
        .values({
          title: String(title),
          subject: String(subject),
          totalQuestions: questionsData.length,
          totalScore,
          questionsData,
          examTrends: examTrends.length > 0 ? examTrends : null,
          overallReview: overallReview ? String(overallReview) : null,
          createdBy: req.session.user!.id,
        })
        .returning();

      res.json({
        success: true,
        message: "시험이 업로드되었습니다.",
        data: exam,
        exam: {
          id: exam.id,
          title: exam.title,
          totalQuestions: exam.totalQuestions,
          totalScore: exam.totalScore,
        },
      });
    } catch (error) {
      console.error("Upload exam error:", error);
      res.status(500).json({ message: "시험 업로드 중 오류가 발생했습니다." });
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
      res.json({ data: exam });
    } catch (error) {
      console.error("Get exam error:", error);
      res.status(500).json({ message: "시험 정보를 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Delete exam
  app.delete("/api/exams/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(examDistributions).where(eq(examDistributions.examId, id));
      await db.delete(exams).where(eq(exams.id, id));
      res.json({ success: true, message: "시험이 삭제되었습니다." });
    } catch (error) {
      console.error("Delete exam error:", error);
      res.status(500).json({ message: "시험 삭제 중 오류가 발생했습니다." });
    }
  });

  // ============ EXAM DISTRIBUTION ROUTES ============

  // Create distribution (admin - distribute to multiple branches)
  app.post("/api/distributions", requireAdmin, async (req, res) => {
    try {
      const { examId, branchIds, startDate, endDate } = req.body;

      if (!examId || !branchIds || branchIds.length === 0) {
        return res.status(400).json({ message: "시험과 지점을 선택해주세요." });
      }

      const distributions = [];
      for (const branchId of branchIds) {
        const [distribution] = await db.insert(examDistributions).values({
          examId,
          branchId,
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          distributedBy: req.session.user!.id,
        }).returning();
        distributions.push(distribution);
      }

      res.json({ success: true, data: distributions, message: `${distributions.length}개 지점에 배포되었습니다.` });
    } catch (error) {
      console.error("Create distribution error:", error);
      res.status(500).json({ message: "시험 배포 중 오류가 발생했습니다." });
    }
  });

  // Delete distribution
  app.delete("/api/distributions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(examDistributions).where(eq(examDistributions.id, id));
      res.json({ success: true, message: "배포가 삭제되었습니다." });
    } catch (error) {
      console.error("Delete distribution error:", error);
      res.status(500).json({ message: "배포 삭제 중 오류가 발생했습니다." });
    }
  });

  // Distribute exam to branch (legacy)
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

      res.json({ success: true, data: distribution });
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

  // Get distributions for branch (GitHub exact format)
  app.get("/api/distributions", requireBranchManager, async (req, res) => {
    try {
      const branchId = req.session.user?.branchId;
      if (!branchId) {
        return res.status(400).json({ message: "지점 정보가 없습니다." });
      }
      
      const distributions = await db.select({
        distribution: examDistributions,
        exam: {
          id: exams.id,
          title: exams.title,
          subject: exams.subject,
          grade: exams.grade,
          totalQuestions: exams.totalQuestions,
          totalScore: exams.totalScore,
        },
      })
      .from(examDistributions)
      .innerJoin(exams, eq(examDistributions.examId, exams.id))
      .where(eq(examDistributions.branchId, branchId))
      .orderBy(desc(examDistributions.createdAt));

      res.json({ success: true, data: distributions.map(d => ({ ...d.distribution, exam: d.exam })) });
    } catch (error) {
      console.error("Get distributions error:", error);
      res.status(500).json({ message: "배포 목록을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Update distribution (redistribute to class/students)
  app.put("/api/distributions/:id", requireBranchManager, async (req, res) => {
    try {
      const { id } = req.params;
      const branchId = req.session.user?.branchId;
      const { classId, studentIds } = req.body;
      
      // Get distribution
      const [distribution] = await db.select().from(examDistributions)
        .where(and(eq(examDistributions.id, id), eq(examDistributions.branchId, branchId!)))
        .limit(1);
      
      if (!distribution) {
        return res.status(404).json({ message: "배포를 찾을 수 없습니다." });
      }
      
      // Update distribution with classId
      await db.update(examDistributions)
        .set({ classId: classId || null })
        .where(eq(examDistributions.id, id));
      
      // Delete existing student assignments
      await db.delete(distributionStudents).where(eq(distributionStudents.distributionId, id));
      
      // If specific students are selected, create student assignments
      if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
        await db.insert(distributionStudents).values(
          studentIds.map((studentId: string) => ({
            distributionId: id,
            studentId,
          }))
        );
      }
      
      res.json({
        success: true,
        message: studentIds && studentIds.length > 0
          ? `${studentIds.length}명의 학생에게 시험이 배포되었습니다.`
          : classId
          ? "반에 시험이 배포되었습니다."
          : "배포가 업데이트되었습니다.",
      });
    } catch (error) {
      console.error("Update distribution error:", error);
      res.status(500).json({ message: "배포 업데이트 중 오류가 발생했습니다." });
    }
  });

  // Get distribution students (GitHub exact format)
  app.get("/api/distributions/:id/students", requireBranchManager, async (req, res) => {
    try {
      const { id } = req.params;
      const branchId = req.session.user?.branchId;
      
      // Get distribution
      const [distribution] = await db.select().from(examDistributions)
        .where(and(eq(examDistributions.id, id), eq(examDistributions.branchId, branchId!)))
        .limit(1);
      
      if (!distribution) {
        return res.status(404).json({ message: "배포를 찾을 수 없습니다." });
      }
      
      // Get exam
      const [exam] = await db.select().from(exams)
        .where(eq(exams.id, distribution.examId)).limit(1);
      
      if (!exam) {
        return res.status(404).json({ message: "시험을 찾을 수 없습니다." });
      }
      
      // Get students based on distribution type
      let studentsList: any[] = [];
      
      if (distribution.classId) {
        // Class-specific distribution
        studentsList = await db.select({ student: students, user: users })
          .from(studentClasses)
          .innerJoin(students, eq(studentClasses.studentId, students.id))
          .innerJoin(users, eq(students.userId, users.id))
          .where(and(
            eq(students.branchId, branchId!),
            eq(studentClasses.classId, distribution.classId)
          ));
      } else {
        // Check for specific students
        const specificStudents = await db.select().from(distributionStudents)
          .where(eq(distributionStudents.distributionId, id));
        
        if (specificStudents.length > 0) {
          const studentIds = specificStudents.map(s => s.studentId);
          studentsList = await db.select({ student: students, user: users })
            .from(students)
            .innerJoin(users, eq(students.userId, users.id))
            .where(and(
              eq(students.branchId, branchId!),
              inArray(students.id, studentIds)
            ));
        } else {
          // All students in branch
          studentsList = await db.select({ student: students, user: users })
            .from(students)
            .innerJoin(users, eq(students.userId, users.id))
            .where(eq(students.branchId, branchId!));
        }
      }
      
      // Get attempts for each student (GitHub exact format - flattened structure)
      const result = await Promise.all(studentsList.map(async (row) => {
        const [attempt] = await db.select().from(examAttempts)
          .where(and(
            eq(examAttempts.studentId, row.student.id),
            eq(examAttempts.examId, exam.id)
          )).limit(1);
        
        let report = null;
        if (attempt) {
          const [r] = await db.select().from(aiReports)
            .where(eq(aiReports.attemptId, attempt.id)).limit(1);
          report = r || null;
        }
        
        // Flatten structure for frontend compatibility (GitHub exact format)
        return {
          studentId: row.student.id,
          studentName: row.user.name,
          phone: row.user.phone,
          school: row.student.school,
          schoolGrade: row.student.grade,
          hasAttempt: !!attempt,
          attemptId: attempt?.id || null,
          score: attempt?.score || null,
          maxScore: exam.totalScore,
          grade: attempt?.grade || null,  // exam grade rank (1-9등급)
          isSubmitted: !!attempt?.submittedAt,  // submitted if submittedAt exists
          submittedAt: attempt?.submittedAt || null,
          answers: attempt?.answers || null,
          hasReport: !!report,
          reportId: report?.id || null,
          // Also include nested data for compatibility
          user: { id: row.user.id, name: row.user.name, phone: row.user.phone },
          attempt,
          report,
        };
      }));
      
      res.json({
        success: true,
        data: {
          distribution,
          exam,
          students: result,
        },
      });
    } catch (error) {
      console.error("Get distribution students error:", error);
      res.status(500).json({ message: "배포 학생 목록 조회 중 오류가 발생했습니다." });
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

  // Branch manager creates exam attempt for student (GitHub exact)
  app.post("/api/exam-attempts/branch-create", requireBranchManager, async (req, res) => {
    try {
      const { studentId, distributionId } = req.body;
      
      if (!studentId || !distributionId) {
        return res.status(400).json({ success: false, message: "학생 ID와 배포 ID가 필요합니다." });
      }

      // Get distribution to get examId
      const [distribution] = await db.select().from(examDistributions)
        .where(eq(examDistributions.id, distributionId)).limit(1);
      
      if (!distribution) {
        return res.status(404).json({ success: false, message: "배포 정보를 찾을 수 없습니다." });
      }

      // Check if attempt already exists
      const existing = await db.select().from(examAttempts)
        .where(and(
          eq(examAttempts.studentId, studentId),
          eq(examAttempts.examId, distribution.examId)
        )).limit(1);

      if (existing.length > 0) {
        return res.json({ 
          success: true, 
          data: existing[0],
          message: "이미 답안지가 존재합니다."
        });
      }

      // Create new attempt with empty answers
      const [attempt] = await db.insert(examAttempts).values({
        examId: distribution.examId,
        studentId,
        distributionId,
        answers: {},
      }).returning();

      res.json({ 
        success: true, 
        data: attempt,
        message: "답안지가 생성되었습니다."
      });
    } catch (error) {
      console.error("Branch create attempt error:", error);
      res.status(500).json({ success: false, message: "답안지 생성 중 오류가 발생했습니다." });
    }
  });

  // Branch manager grades/updates exam attempt (GitHub exact)
  app.put("/api/exam-attempts/:attemptId/branch-grade", requireBranchManager, async (req, res) => {
    try {
      const { attemptId } = req.params;
      const { gradingData, answers: legacyAnswers } = req.body;

      // Get attempt
      const [attempt] = await db.select().from(examAttempts)
        .where(eq(examAttempts.id, attemptId)).limit(1);
      
      if (!attempt) {
        return res.status(404).json({ success: false, message: "답안지를 찾을 수 없습니다." });
      }

      // Get exam for grading
      const [exam] = await db.select().from(exams)
        .where(eq(exams.id, attempt.examId)).limit(1);
      
      if (!exam) {
        return res.status(404).json({ success: false, message: "시험을 찾을 수 없습니다." });
      }

      let gradeResult;
      let answersToSave: any = {};

      if (gradingData) {
        // New grading format: correctQuestions, wrongQuestions
        const { correctQuestions, wrongQuestions, totalQuestions } = gradingData;
        const questionsData = exam.questionsData as any[];
        
        // Calculate score based on correct/wrong marking
        let score = 0;
        let maxScore = 0;
        const correctCount = correctQuestions.length;
        
        questionsData.forEach((q: any) => {
          const points = q.points || q.배점 || 2;
          maxScore += points;
          if (correctQuestions.includes(q.questionNumber || q.문항번호)) {
            score += points;
          }
        });

        // If no questionsData matching, use simple calculation
        if (maxScore === 0) {
          maxScore = totalQuestions * 2;
          score = correctCount * 2;
        }

        const percentage = (score / maxScore) * 100;
        let grade = 9;
        if (percentage >= 96) grade = 1;
        else if (percentage >= 89) grade = 2;
        else if (percentage >= 77) grade = 3;
        else if (percentage >= 60) grade = 4;
        else if (percentage >= 40) grade = 5;
        else if (percentage >= 23) grade = 6;
        else if (percentage >= 11) grade = 7;
        else if (percentage >= 4) grade = 8;

        gradeResult = { score, maxScore, correctCount, grade };

        // Save correct/wrong info in answers field
        correctQuestions.forEach((qNum: number) => { answersToSave[qNum] = 'correct'; });
        wrongQuestions.forEach((qNum: number) => { answersToSave[qNum] = 'wrong'; });
      } else if (legacyAnswers) {
        // Legacy format: numbered answers
        gradeResult = gradeExam(legacyAnswers, exam.questionsData as any[]);
        answersToSave = legacyAnswers;
      } else {
        return res.status(400).json({ success: false, message: "채점 데이터가 없습니다." });
      }

      // Update attempt
      const [updated] = await db.update(examAttempts)
        .set({
          answers: answersToSave,
          score: gradeResult.score,
          maxScore: gradeResult.maxScore,
          correctCount: gradeResult.correctCount,
          grade: gradeResult.grade,
          submittedAt: new Date(),
          gradedAt: new Date(),
        })
        .where(eq(examAttempts.id, attemptId))
        .returning();

      res.json({ 
        success: true, 
        data: updated,
        message: "채점 결과가 저장되었습니다."
      });
    } catch (error) {
      console.error("Branch grade attempt error:", error);
      res.status(500).json({ success: false, message: "채점 저장 중 오류가 발생했습니다." });
    }
  });

  // Get single exam attempt
  app.get("/api/exam-attempts/:attemptId", requireBranchManager, async (req, res) => {
    try {
      const { attemptId } = req.params;
      
      const [attempt] = await db.select().from(examAttempts)
        .where(eq(examAttempts.id, attemptId)).limit(1);
      
      if (!attempt) {
        return res.status(404).json({ success: false, message: "답안지를 찾을 수 없습니다." });
      }

      res.json({ success: true, data: attempt });
    } catch (error) {
      console.error("Get attempt error:", error);
      res.status(500).json({ success: false, message: "답안지 조회 중 오류가 발생했습니다." });
    }
  });

  // Delete exam attempt
  app.delete("/api/exam-attempts/:attemptId", requireBranchManager, async (req, res) => {
    try {
      const { attemptId } = req.params;
      
      await db.delete(examAttempts).where(eq(examAttempts.id, attemptId));

      res.json({ success: true, message: "답안지가 삭제되었습니다." });
    } catch (error) {
      console.error("Delete attempt error:", error);
      res.status(500).json({ success: false, message: "답안지 삭제 중 오류가 발생했습니다." });
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

  // Generate AI report for attempt (GitHub exact implementation with OLGA Meta Prompt v2)
  app.post("/api/reports/generate/:attemptId", requireBranchManager, async (req, res) => {
    try {
      const { attemptId } = req.params;

      // Check if report already exists
      const [existingReport] = await db.select().from(aiReports).where(eq(aiReports.attemptId, attemptId)).limit(1);
      if (existingReport) {
        return res.json(existingReport);
      }

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
      const studentAnswers = attempt.answers as Record<string, number | string>;

      console.log('[AI Report] Student:', user.name);
      console.log('[AI Report] Questions count:', questionsData?.length);
      console.log('[AI Report] Student answers:', JSON.stringify(studentAnswers));
      console.log('[AI Report] Sample question:', JSON.stringify(questionsData?.[0]));

      // Calculate domain stats (영역별 성적 분석)
      // Handle both formats: 
      // 1. Manager grading: answers = { "1": "correct", "2": "wrong" }
      // 2. Student submission: answers = { "1": 1, "2": 3 }
      const domainMap = new Map<string, { name: string; correct: number; total: number; earnedScore: number; maxScore: number }>();
      
      for (const q of questionsData) {
        const domain = q.domain || q.topic || q.category || '독서';
        const qNum = q.questionNumber || q.number || (questionsData.indexOf(q) + 1);
        const rawAnswer = studentAnswers[String(qNum)];
        const qScore = Number(q.score) || 2;
        
        // Determine if correct based on answer format
        let isCorrect = false;
        if (rawAnswer === 'correct') {
          // Manager grading format
          isCorrect = true;
        } else if (rawAnswer === 'wrong') {
          isCorrect = false;
        } else if (rawAnswer !== undefined && rawAnswer !== null) {
          // Numeric comparison for student submissions
          const studentAnswer = Number(rawAnswer);
          const correctAnswer = Number(q.correctAnswer);
          isCorrect = !isNaN(studentAnswer) && !isNaN(correctAnswer) && studentAnswer === correctAnswer;
        }

        if (!domainMap.has(domain)) {
          domainMap.set(domain, { name: domain, correct: 0, total: 0, earnedScore: 0, maxScore: 0 });
        }

        const domainData = domainMap.get(domain)!;
        domainData.total++;
        domainData.maxScore += qScore;
        if (isCorrect) {
          domainData.correct++;
          domainData.earnedScore += qScore;
        }
      }

      const domainStats = Array.from(domainMap.values()).map(d => ({
        ...d,
        percentage: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
      }));

      console.log('[AI Report] Domain stats:', JSON.stringify(domainStats, null, 2));

      // Get all completed attempts for ranking
      const allAttempts = await db.select().from(examAttempts).where(eq(examAttempts.examId, attempt.examId));
      const completedAttempts = allAttempts.filter(a => a.score !== null && a.submittedAt !== null);
      const sortedAttempts = completedAttempts.sort((a, b) => (b.score || 0) - (a.score || 0));
      const rank = sortedAttempts.findIndex(a => a.id === attemptId) + 1;

      // Helper function to check if answer is correct (handles both formats)
      const checkIsCorrect = (q: any): boolean => {
        const qNum = q.questionNumber || q.number;
        const rawAnswer = studentAnswers[String(qNum)];
        if (rawAnswer === 'correct') return true;
        if (rawAnswer === 'wrong') return false;
        if (rawAnswer !== undefined && rawAnswer !== null) {
          const studentAns = Number(rawAnswer);
          const correctAns = Number(q.correctAnswer);
          return !isNaN(studentAns) && !isNaN(correctAns) && studentAns === correctAns;
        }
        return false;
      };

      // Prepare wrong/correct questions analysis
      const incorrectQuestions = questionsData.filter((q: any) => !checkIsCorrect(q));
      const correctQuestions = questionsData.filter((q: any) => checkIsCorrect(q));
      
      console.log('[AI Report] Correct:', correctQuestions.length, 'Incorrect:', incorrectQuestions.length);

      // 학년별 프로그램 철학 (GitHub exact)
      const gradePhilosophy: { [key: string]: string } = {
        '중1': '올가의 중1 프로그램은 국어의 기초 개념을 튼튼히 다지는 데 중점을 둡니다.',
        '중2': '올가의 중2 프로그램은 독해력과 문법의 심화 학습에 집중합니다.',
        '중3': '올가의 중3 프로그램은 고등 국어로의 전환을 준비하며 실전 독해를 강화합니다.',
        '고1': '올가의 고1 프로그램은 수능 국어의 기본 체계를 구축하는 데 집중합니다.',
        '고2': '올가의 고2 프로그램은 수능 독서 지문 분석과 문학 감상 능력을 고도화합니다.',
        '고3': '올가의 고3 프로그램은 수능 최적화 전략과 킬러 문항 대응력을 완성합니다.',
      };
      const philosophy = gradePhilosophy[student.grade || ''] || '올가의 프로그램은 학생의 실력 향상에 집중합니다.';

      // Build userData for AI (GitHub exact structure)
      const userData = {
        studentAnswer: {
          학생명: user.name,
          학년: student.grade || '고등학생',
          시험명: exam.title,
          원점수: attempt.score,
          만점: attempt.maxScore,
          정답률: Math.round((attempt.score || 0) / (attempt.maxScore || 100) * 100),
          등급: attempt.grade,
          순위: `${rank}/${completedAttempts.length}`,
          프로그램철학: philosophy,
          영역별성취도: domainStats.map(d => ({
            영역: d.name,
            취득점수: d.earnedScore,
            만점: d.maxScore,
            정답수: d.correct,
            전체문항: d.total,
            정답률: d.percentage
          }))
        },
        masterCsv: {
          틀린문항: incorrectQuestions.map((q: any) => {
            const qNum = q.questionNumber || q.number;
            return {
              문항번호: qNum,
              영역: q.domain || q.topic || '미분류',
              난이도: q.difficulty || '중',
              유형: q.typeAnalysis || q.type || '미분류',
              소분류: q.subcategory || q.concept || '미분류',
              정답: q.correctAnswer,
              학생답안: studentAnswers[String(qNum)] || '무응답'
            };
          }),
          맞은문항: correctQuestions.map((q: any) => {
            const qNum = q.questionNumber || q.number;
            return {
              문항번호: qNum,
              영역: q.domain || q.topic || '미분류',
              난이도: q.difficulty || '중',
              유형: q.typeAnalysis || q.type || '미분류',
              소분류: q.subcategory || q.concept || '미분류'
            };
          })
        },
        average: {
          응시학생수: completedAttempts.length,
          영역별평균: domainStats.map(d => ({
            영역: d.name,
            평균점수: Math.round(d.maxScore * 0.65),
            평균정답률: 65
          }))
        }
      };

      // Step 1: Calculate strengths (≥80%) and weaknesses (<60%) from domainStats
      const strengthDomains = domainStats.filter(d => d.percentage >= 80);
      const weaknessDomains = domainStats.filter(d => d.percentage < 60);
      
      console.log('[AI Report] Generating report for:', user.name, 'Attempt:', attemptId);
      console.log('[AI Report] Strengths:', strengthDomains.map(d => d.name));
      console.log('[AI Report] Weaknesses:', weaknessDomains.map(d => d.name));

      // Step 2: Build simplified AI prompt - ask for TEXT content only
      const simplePrompt = `당신은 올가교육 수능연구소의 데이터 분석 전문가입니다.
아래 학생의 성적 데이터를 분석하여 각 섹션별 텍스트를 작성하세요.

[학생 정보]
- 이름: ${user.name}
- 학년: ${student.grade || '고등학생'}
- 시험: ${exam.title}
- 점수: ${attempt.score}/${attempt.maxScore}점 (${Math.round((attempt.score || 0) / (attempt.maxScore || 100) * 100)}%)
- 등급: ${attempt.grade}등급

[영역별 성취도]
${domainStats.map(d => `- ${d.name}: ${d.percentage}% (${d.correct}/${d.total}문항)`).join('\n')}

[강점 영역 (80% 이상)]
${strengthDomains.length > 0 ? strengthDomains.map(d => `- ${d.name}: ${d.percentage}%`).join('\n') : '없음'}

[약점 영역 (60% 미만)]
${weaknessDomains.length > 0 ? weaknessDomains.map(d => `- ${d.name}: ${d.percentage}%`).join('\n') : '없음'}

[틀린 문항 분석]
${incorrectQuestions.slice(0, 5).map((q: any) => `- ${q.domain || '미분류'} 영역, ${q.difficulty || '중'} 난이도`).join('\n')}

다음 JSON 형식으로 응답하세요:
{
  "olgaSummary": "올가 분석 총평 (학생의 전체적인 성적 분석과 향후 학습 방향 제시, 200자 내외)",
  "domainAnalysis": {
    "영역명1": "해당 영역의 구체적인 분석 텍스트 (100자 내외)",
    "영역명2": "해당 영역의 구체적인 분석 텍스트 (100자 내외)"
  },
  "strengthsAnalysis": [
    { "domain": "강점 영역명", "text": "강점 분석 텍스트 (100자 내외)" }
  ],
  "weaknessesAnalysis": [
    { "domain": "약점 영역명", "text": "약점 분석 및 개선 방향 텍스트 (100자 내외)" }
  ],
  "propensity": {
    "title": "학생 성향 타입 (예: 안정적 실력형, 도전적 성장형 등)",
    "description": "성향 설명 (150자 내외)"
  }
}`;

      // Step 3: Call Gemini API with simplified prompt
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
          maxOutputTokens: 2000,
        }
      });

      let aiContent: any = {};
      const maxRetries = 3;
      
      for (let retryAttempt = 0; retryAttempt < maxRetries; retryAttempt++) {
        try {
          if (retryAttempt > 0) {
            const delay = Math.pow(2, retryAttempt) * 1000;
            console.log(`[AI Report] Retrying in ${delay/1000}s (attempt ${retryAttempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: simplePrompt }] }]
          });
          
          const responseText = result.response.text() || "{}";
          let cleanedText = responseText.trim();
          if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
          } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          aiContent = JSON.parse(cleanedText);
          console.log('[AI Report] AI content generated successfully');
          break;
        } catch (aiError: any) {
          console.error(`[AI Report] Attempt ${retryAttempt + 1} failed:`, aiError?.message);
          if (retryAttempt === maxRetries - 1 || (aiError?.status !== 429)) {
            // Fallback to basic content
            aiContent = {
              olgaSummary: `${user.name} 학생은 ${attempt.score}/${attempt.maxScore}점으로 ${attempt.grade}등급을 획득했습니다. 전체적으로 ${Math.round((attempt.score || 0) / (attempt.maxScore || 100) * 100)}%의 정답률을 보였습니다.`,
              domainAnalysis: {},
              strengthsAnalysis: [],
              weaknessesAnalysis: [],
              propensity: { title: '분석 완료', description: '데이터 분석이 완료되었습니다.' }
            };
            break;
          }
        }
      }

      // Step 4: Calculate percentile and standard score
      const percentile = completedAttempts.length > 0 
        ? Math.round(100 * (1 - (rank / completedAttempts.length)) * 10) / 10 
        : 50;
      
      const gradeValue = attempt.grade || 5;
      const standardScore = gradeValue <= 2 
        ? 80 + (attempt.score || 0) / (attempt.maxScore || 100) * 20 
        : gradeValue <= 4 
          ? 70 + (attempt.score || 0) / (attempt.maxScore || 100) * 10 
          : Math.round(60 + (attempt.score || 0) / (attempt.maxScore || 100) * 10);

      // Step 5: Map AI content to template structure
      const domainAnalysisMap = aiContent.domainAnalysis || {};
      
      // Build strengths array from calculated data + AI text
      const strengths = strengthDomains.map(d => ({
        name: d.name,
        score: d.percentage,
        analysisText: domainAnalysisMap[d.name] || 
          (aiContent.strengthsAnalysis || []).find((s: any) => s.domain === d.name)?.text ||
          `${d.name} 영역에서 ${d.percentage}%의 우수한 정답률을 보이며, 해당 영역에 대한 탄탄한 기초 실력을 갖추고 있습니다.`
      }));

      // Build weaknesses array from calculated data + AI text
      const weaknesses = weaknessDomains.map(d => ({
        name: d.name,
        score: d.percentage,
        analysisText: domainAnalysisMap[d.name] || 
          (aiContent.weaknessesAnalysis || []).find((w: any) => w.domain === d.name)?.text ||
          `${d.name} 영역에서 ${d.percentage}%의 정답률로 보완이 필요합니다. 기본 개념 정리와 유형별 문제 풀이 연습이 권장됩니다.`
      }));

      // Build subjectDetails with AI analysis text
      const subjectDetails = domainStats.map(d => ({
        name: d.name,
        score: d.percentage,
        scoreText: `취득 ${d.earnedScore}점 / 만점 ${d.maxScore}점 (${d.correct}/${d.total}문항 정답)`,
        statusColor: d.percentage >= 80 ? 'blue' : d.percentage >= 70 ? 'green' : d.percentage >= 60 ? 'orange' : 'red',
        analysisText: domainAnalysisMap[d.name] || `${d.name} 영역에서 ${d.percentage}%의 정답률을 기록했습니다.`
      }));

      const reportData = {
        metaVersion: 'v2-simplified',
        studentInfo: {
          name: user.name,
          school: student.school || '미지정',
          date: attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR'),
          level: student.grade || '미지정',
        },
        scoreSummary: {
          grade: attempt.grade,
          rawScore: attempt.score,
          rawScoreMax: attempt.maxScore,
          standardScore: Math.round(standardScore),
          percentile: percentile,
        },
        charts: {
          radarChartData: {
            student: domainStats.map(d => d.percentage),
            average: domainStats.map(() => 65),
          },
          predictionChartData: [
            Math.round((attempt.score || 0) / (attempt.maxScore || 100) * 100),
            Math.min(Math.round((attempt.score || 0) / (attempt.maxScore || 100) * 100) + 5, 100),
            Math.min(Math.round((attempt.score || 0) / (attempt.maxScore || 100) * 100) + 10, 100),
            Math.min(Math.round((attempt.score || 0) / (attempt.maxScore || 100) * 100) + 15, 100),
          ],
        },
        analysis: {
          olgaSummary: aiContent.olgaSummary || `${user.name} 학생의 성적 분석 결과입니다.`,
          subjectDetails,
          strengths,
          weaknesses,
          propensity: {
            typeTitle: aiContent.propensity?.title || '분석 완료',
            typeDescription: aiContent.propensity?.description || `${user.name} 학생은 ${attempt.grade}등급 수준의 실력을 갖추고 있습니다.`,
          },
        },
      };

      // Extract legacy format fields for database
      const summary = reportData.analysis.olgaSummary;
      const weakAreas = weaknesses.map((w: any) => w.name);
      const recommendations = strengths.map((s: any) => s.analysisText);
      const expectedGrade = attempt.grade;

      // Generate full 5-page A4 HTML report using GitHub template
      const htmlContent = generateReportHTML(reportData);
      console.log('[AI Report] HTML generated, length:', htmlContent.length);

      // Save report to database
      console.log('[AI Report] Saving to database...');
      console.log('[AI Report] Data:', { attemptId, studentId: student.id, examId: exam.id, expectedGrade });
      
      try {
        const [report] = await db.insert(aiReports).values({
          attemptId,
          studentId: student.id,
          examId: exam.id,
          analysis: reportData,
          weakAreas,
          recommendations,
          expectedGrade: typeof expectedGrade === 'number' ? expectedGrade : attempt.grade,
          summary,
          htmlContent,
        }).returning();

        console.log('[AI Report] Database insert SUCCESS, report ID:', report.id);
        console.log('[AI Report] Generated successfully for:', user.name);
        res.json(report);
      } catch (dbError: any) {
        console.error('[AI Report] Database insert FAILED:', dbError?.message || dbError);
        console.error('[AI Report] Full error:', JSON.stringify(dbError, null, 2));
        throw dbError;
      }
    } catch (error: any) {
      console.error("Generate report error:", error);
      
      // Handle rate limit error (429)
      if (error?.status === 429 || error?.statusText === 'Too Many Requests') {
        res.status(429).json({ message: "AI 요청이 너무 많습니다. 1분 후에 다시 시도해주세요." });
      } else if (error?.message?.includes('API key')) {
        res.status(500).json({ message: "Gemini API 키가 설정되지 않았습니다. 관리자에게 문의하세요." });
      } else {
        res.status(500).json({ message: "AI 리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
      }
    }
  });

  // Get AI report (JSON)
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

  // Delete AI report (for re-analysis)
  app.delete("/api/reports/:attemptId", requireBranchManager, async (req, res) => {
    try {
      const { attemptId } = req.params;
      
      const [existingReport] = await db.select().from(aiReports).where(eq(aiReports.attemptId, attemptId)).limit(1);
      if (!existingReport) {
        return res.status(404).json({ message: "삭제할 보고서가 없습니다." });
      }
      
      await db.delete(aiReports).where(eq(aiReports.attemptId, attemptId));
      
      console.log('[AI Report] Deleted report for attempt:', attemptId);
      res.json({ success: true, message: "보고서가 삭제되었습니다. 다시 분석할 수 있습니다." });
    } catch (error) {
      console.error("Delete report error:", error);
      res.status(500).json({ message: "보고서 삭제 중 오류가 발생했습니다." });
    }
  });

  // Get AI report as HTML page (for PDF download)
  app.get("/api/reports/:attemptId/html", requireAuth, async (req, res) => {
    try {
      const { attemptId } = req.params;
      const [report] = await db.select().from(aiReports).where(eq(aiReports.attemptId, attemptId)).limit(1);
      
      if (!report) {
        return res.status(404).send('<html><body><h1>리포트를 찾을 수 없습니다.</h1></body></html>');
      }

      // If htmlContent exists, serve it directly
      if (report.htmlContent) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(report.htmlContent);
      }

      // Otherwise regenerate from analysis data
      if (report.analysis) {
        const htmlContent = generateReportHTML(report.analysis);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(htmlContent);
      }

      res.status(404).send('<html><body><h1>리포트 데이터가 없습니다.</h1></body></html>');
    } catch (error) {
      console.error("Get report HTML error:", error);
      res.status(500).send('<html><body><h1>리포트를 불러오는 중 오류가 발생했습니다.</h1></body></html>');
    }
  });

  // ============ DASHBOARD STATS ============

  // Admin dashboard stats (GitHub exact format)
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const [branchCount] = await db.select({ count: sql<number>`count(*)` }).from(branches);
      const [studentCount] = await db.select({ count: sql<number>`count(*)` }).from(students);
      const [examCount] = await db.select({ count: sql<number>`count(*)` }).from(exams);
      
      const [avgScore] = await db
        .select({ avg: sql<number>`avg(${examAttempts.score})` })
        .from(examAttempts)
        .where(sql`${examAttempts.submittedAt} IS NOT NULL`);

      const branchList = await db.select().from(branches).orderBy(branches.displayOrder);
      const branchStats = [];
      
      for (const branch of branchList) {
        const [branchStudentCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(students)
          .where(eq(students.branchId, branch.id));
          
        const [branchExamCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(examAttempts)
          .innerJoin(students, eq(examAttempts.studentId, students.id))
          .where(eq(students.branchId, branch.id));
          
        const [branchAvgScore] = await db
          .select({ avg: sql<number>`avg(${examAttempts.score})` })
          .from(examAttempts)
          .innerJoin(students, eq(examAttempts.studentId, students.id))
          .where(and(eq(students.branchId, branch.id), sql`${examAttempts.submittedAt} IS NOT NULL`));
          
        branchStats.push({
          branchName: branch.name,
          studentCount: Number(branchStudentCount.count) || 0,
          examCount: Number(branchExamCount.count) || 0,
          averageScore: branchAvgScore.avg ? Math.round(Number(branchAvgScore.avg)) : 0,
        });
      }

      res.json({
        success: true,
        data: {
          totalStudents: Number(studentCount.count) || 0,
          totalBranches: Number(branchCount.count) || 0,
          totalExams: Number(examCount.count) || 0,
          averageScore: avgScore.avg ? Math.round(Number(avgScore.avg)) : 0,
          branchStats,
        },
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

      res.json({ data: {
        students: Number(studentCount.count),
        classes: Number(classCount.count),
        distributions: Number(distCount.count),
      }});
    } catch (error) {
      console.error("Get branch stats error:", error);
      res.status(500).json({ message: "통계를 불러오는 중 오류가 발생했습니다." });
    }
  });

  // ============ INIT ADMIN ============
  
  // Create initial admin and test accounts (only if no admin exists)
  app.post("/api/init", async (req, res) => {
    try {
      const existingAdmin = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
      if (existingAdmin.length > 0) {
        return res.status(400).json({ message: "관리자가 이미 존재합니다." });
      }

      // Create admin account: allga / allga
      const adminPasswordHash = await hashPassword("allga");
      const [admin] = await db.insert(users).values({
        username: "allga",
        passwordHash: adminPasswordHash,
        name: "총괄 관리자",
        role: "admin",
      }).returning();

      // Create a default branch: 강남점
      const [gangnamBranch] = await db.insert(branches).values({
        name: "강남점",
        address: "서울시 강남구",
        phone: "02-1234-5678",
        managerName: "강남점 관리자",
      }).returning();

      // Create branch manager account: allga1 / allga1
      const branchPasswordHash = await hashPassword("allga1");
      await db.insert(users).values({
        username: "allga1",
        passwordHash: branchPasswordHash,
        name: "강남점 관리자",
        role: "branch",
        branchId: gangnamBranch.id,
      });

      res.json({ 
        success: true, 
        message: "초기 계정이 생성되었습니다.", 
        accounts: [
          { type: "관리자", username: "allga", password: "allga" },
          { type: "지점장", username: "allga1", password: "allga1" },
        ]
      });
    } catch (error) {
      console.error("Init admin error:", error);
      res.status(500).json({ message: "초기 설정 중 오류가 발생했습니다." });
    }
  });

  return httpServer;
}
