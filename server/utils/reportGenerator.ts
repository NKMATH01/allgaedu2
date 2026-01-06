import { db } from "../db";
import { 
  examAnalysisData, studentScoreData, aiAnalysisData, aiReports,
  exams, students, users, examAttempts
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { generateReportHTML } from "../templates/newReportTemplate";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenerativeAI(apiKey);
}

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

export interface Step1ExamAnalysis {
  examId: string;
  totalQuestions: number;
  totalScore: number;
  domainBreakdown: Array<{
    domain: string;
    questionCount: number;
    maxScore: number;
    percentage: number;
  }>;
  difficultyBreakdown: Array<{
    difficulty: string;
    questionCount: number;
    maxScore: number;
  }>;
  questionTypeBreakdown: Array<{
    type: string;
    questionCount: number;
  }>;
  examCharacteristics: {
    mainDomains: string[];
    difficultyDistribution: string;
    avgScorePerQuestion: number;
  };
}

export interface Step2StudentScore {
  attemptId: string;
  studentId: string;
  examId: string;
  rawScore: number;
  maxScore: number;
  percentile: number;
  grade: number;
  correctCount: number;
  incorrectCount: number;
  domainScores: Array<{
    domain: string;
    earnedScore: number;
    maxScore: number;
    correctCount: number;
    totalCount: number;
    percentage: number;
    statusColor: string;
  }>;
  difficultyScores: Array<{
    difficulty: string;
    correctCount: number;
    totalCount: number;
    percentage: number;
  }>;
  incorrectQuestions: Array<{
    questionNumber: number;
    domain: string;
    difficulty: string;
    type: string;
    subcategory: string;
    correctAnswer: number;
    studentAnswer: number | string;
  }>;
  correctQuestions: Array<{
    questionNumber: number;
    domain: string;
    difficulty: string;
    type: string;
    subcategory: string;
  }>;
  strengthDomains: string[];
  weaknessDomains: string[];
}

export interface Step3AIAnalysis {
  attemptId: string;
  studentId: string;
  examId: string;
  propensityType: string;
  propensityDescription: string;
  overallSummary: string;
  domainAnalyses: Array<{
    domain: string;
    score: number;
    scoreText: string;
    analysisText: string;
    statusColor: string;
  }>;
  strengthAnalyses: Array<{
    name: string;
    score: number;
    analysisText: string;
  }>;
  weaknessAnalyses: Array<{
    name: string;
    score: number;
    analysisText: string;
  }>;
  learningStrategy: Array<{
    stage: string;
    duration: string;
    strategy: string;
    details: string;
    expectedResult: string;
  }>;
  predictedProgress: {
    labels: string[];
    values: number[];
  };
  aiProvider: string;
}

export async function step1AnalyzeExam(examId: string): Promise<Step1ExamAnalysis> {
  console.log('[Step 1] Analyzing exam:', examId);
  
  const [existingAnalysis] = await db.select().from(examAnalysisData)
    .where(eq(examAnalysisData.examId, examId)).limit(1);
  
  if (existingAnalysis) {
    console.log('[Step 1] Using cached exam analysis');
    return {
      examId,
      totalQuestions: existingAnalysis.totalQuestions,
      totalScore: existingAnalysis.totalScore,
      domainBreakdown: existingAnalysis.domainBreakdown as any,
      difficultyBreakdown: existingAnalysis.difficultyBreakdown as any,
      questionTypeBreakdown: existingAnalysis.questionTypeBreakdown as any,
      examCharacteristics: existingAnalysis.examCharacteristics as any,
    };
  }

  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) throw new Error("Exam not found");

  const questionsData = exam.questionsData as any[];
  
  const domainMap = new Map<string, { count: number; maxScore: number }>();
  const difficultyMap = new Map<string, { count: number; maxScore: number }>();
  const typeMap = new Map<string, number>();

  for (const q of questionsData) {
    const domain = q.domain || q.topic || q.category || '독서';
    const difficulty = q.difficulty || '중';
    const type = q.typeAnalysis || q.type || '미분류';
    const score = Number(q.score) || Number(q.points) || 2;

    if (!domainMap.has(domain)) domainMap.set(domain, { count: 0, maxScore: 0 });
    const d = domainMap.get(domain)!;
    d.count++;
    d.maxScore += score;

    if (!difficultyMap.has(difficulty)) difficultyMap.set(difficulty, { count: 0, maxScore: 0 });
    const diff = difficultyMap.get(difficulty)!;
    diff.count++;
    diff.maxScore += score;

    typeMap.set(type, (typeMap.get(type) || 0) + 1);
  }

  const domainBreakdown = Array.from(domainMap.entries()).map(([domain, data]) => ({
    domain,
    questionCount: data.count,
    maxScore: data.maxScore,
    percentage: Math.round(data.count / questionsData.length * 100),
  }));

  const difficultyBreakdown = Array.from(difficultyMap.entries()).map(([difficulty, data]) => ({
    difficulty,
    questionCount: data.count,
    maxScore: data.maxScore,
  }));

  const questionTypeBreakdown = Array.from(typeMap.entries()).map(([type, count]) => ({
    type,
    questionCount: count,
  }));

  const mainDomains = domainBreakdown.sort((a, b) => b.questionCount - a.questionCount).slice(0, 3).map(d => d.domain);
  const diffCounts = difficultyBreakdown.map(d => `${d.difficulty}:${d.questionCount}`).join(', ');

  const result: Step1ExamAnalysis = {
    examId,
    totalQuestions: questionsData.length,
    totalScore: exam.totalScore,
    domainBreakdown,
    difficultyBreakdown,
    questionTypeBreakdown,
    examCharacteristics: {
      mainDomains,
      difficultyDistribution: diffCounts,
      avgScorePerQuestion: Math.round(exam.totalScore / questionsData.length * 10) / 10,
    },
  };

  await db.insert(examAnalysisData).values({
    examId,
    totalQuestions: result.totalQuestions,
    totalScore: result.totalScore,
    domainBreakdown: result.domainBreakdown,
    difficultyBreakdown: result.difficultyBreakdown,
    questionTypeBreakdown: result.questionTypeBreakdown,
    examCharacteristics: result.examCharacteristics,
  });

  console.log('[Step 1] Exam analysis saved:', domainBreakdown.length, 'domains');
  return result;
}

export async function step2CalculateStudentScore(
  attemptId: string,
  forceRecalculate: boolean = false
): Promise<Step2StudentScore> {
  console.log('[Step 2] Calculating student score:', attemptId);
  
  if (!forceRecalculate) {
    const [existing] = await db.select().from(studentScoreData)
      .where(eq(studentScoreData.attemptId, attemptId)).limit(1);
    
    if (existing) {
      console.log('[Step 2] Using cached student score data');
      return {
        attemptId,
        studentId: existing.studentId,
        examId: existing.examId,
        rawScore: existing.rawScore,
        maxScore: existing.maxScore,
        percentile: existing.percentile || 0,
        grade: existing.grade || 5,
        correctCount: existing.correctCount,
        incorrectCount: existing.incorrectCount,
        domainScores: existing.domainScores as any,
        difficultyScores: existing.difficultyScores as any,
        incorrectQuestions: existing.incorrectQuestions as any,
        correctQuestions: existing.correctQuestions as any,
        strengthDomains: existing.strengthDomains as any,
        weaknessDomains: existing.weaknessDomains as any,
      };
    }
  }

  const [attemptData] = await db.select({
    attempt: examAttempts,
    exam: exams,
  })
  .from(examAttempts)
  .innerJoin(exams, eq(examAttempts.examId, exams.id))
  .where(eq(examAttempts.id, attemptId))
  .limit(1);

  if (!attemptData) throw new Error("Attempt not found");

  const { attempt, exam } = attemptData;
  const questionsData = exam.questionsData as any[];
  const studentAnswers = attempt.answers as Record<string, number | string>;

  const domainMap = new Map<string, { correct: number; total: number; earned: number; max: number }>();
  const difficultyMap = new Map<string, { correct: number; total: number }>();
  const incorrectQuestions: any[] = [];
  const correctQuestions: any[] = [];

  for (const q of questionsData) {
    const domain = q.domain || q.topic || q.category || '독서';
    const difficulty = q.difficulty || '중';
    const type = q.typeAnalysis || q.type || '미분류';
    const subcategory = q.subcategory || q.concept || '미분류';
    const qNum = q.questionNumber || q.number || (questionsData.indexOf(q) + 1);
    const qScore = Number(q.score) || Number(q.points) || 2;
    const rawAnswer = studentAnswers[String(qNum)];

    let isCorrect = false;
    if (rawAnswer === 'correct') {
      isCorrect = true;
    } else if (rawAnswer === 'wrong') {
      isCorrect = false;
    } else if (rawAnswer !== undefined && rawAnswer !== null) {
      const studentAnswer = Number(rawAnswer);
      const correctAnswer = Number(q.correctAnswer);
      isCorrect = !isNaN(studentAnswer) && !isNaN(correctAnswer) && studentAnswer === correctAnswer;
    }

    if (!domainMap.has(domain)) domainMap.set(domain, { correct: 0, total: 0, earned: 0, max: 0 });
    const d = domainMap.get(domain)!;
    d.total++;
    d.max += qScore;
    if (isCorrect) {
      d.correct++;
      d.earned += qScore;
    }

    if (!difficultyMap.has(difficulty)) difficultyMap.set(difficulty, { correct: 0, total: 0 });
    const diff = difficultyMap.get(difficulty)!;
    diff.total++;
    if (isCorrect) diff.correct++;

    if (isCorrect) {
      correctQuestions.push({ questionNumber: qNum, domain, difficulty, type, subcategory });
    } else {
      incorrectQuestions.push({
        questionNumber: qNum,
        domain,
        difficulty,
        type,
        subcategory,
        correctAnswer: q.correctAnswer,
        studentAnswer: rawAnswer || '무응답',
      });
    }
  }

  const domainScores = Array.from(domainMap.entries()).map(([domain, data]) => {
    const percentage = Math.round(data.correct / data.total * 100);
    let statusColor = 'blue';
    if (percentage < 60) statusColor = 'red';
    else if (percentage < 80) statusColor = 'orange';
    
    return {
      domain,
      earnedScore: data.earned,
      maxScore: data.max,
      correctCount: data.correct,
      totalCount: data.total,
      percentage,
      statusColor,
    };
  });

  const difficultyScores = Array.from(difficultyMap.entries()).map(([difficulty, data]) => ({
    difficulty,
    correctCount: data.correct,
    totalCount: data.total,
    percentage: Math.round(data.correct / data.total * 100),
  }));

  const strengthDomains = domainScores.filter(d => d.percentage >= 80).map(d => d.domain);
  const weaknessDomains = domainScores.filter(d => d.percentage < 60).map(d => d.domain);

  const correctCount = correctQuestions.length;
  const incorrectCount = incorrectQuestions.length;
  const rawScore = attempt.score || domainScores.reduce((sum, d) => sum + d.earnedScore, 0);
  const maxScore = attempt.maxScore || exam.totalScore;
  const percentile = Math.round(rawScore / maxScore * 100);

  const result: Step2StudentScore = {
    attemptId,
    studentId: attempt.studentId,
    examId: attempt.examId,
    rawScore,
    maxScore,
    percentile,
    grade: attempt.grade || 5,
    correctCount,
    incorrectCount,
    domainScores,
    difficultyScores,
    incorrectQuestions,
    correctQuestions,
    strengthDomains,
    weaknessDomains,
  };

  if (forceRecalculate) {
    await db.delete(studentScoreData).where(eq(studentScoreData.attemptId, attemptId));
  }

  await db.insert(studentScoreData).values({
    attemptId,
    studentId: result.studentId,
    examId: result.examId,
    rawScore: result.rawScore,
    maxScore: result.maxScore,
    percentile: result.percentile,
    grade: result.grade,
    correctCount: result.correctCount,
    incorrectCount: result.incorrectCount,
    domainScores: result.domainScores,
    difficultyScores: result.difficultyScores,
    incorrectQuestions: result.incorrectQuestions,
    correctQuestions: result.correctQuestions,
    strengthDomains: result.strengthDomains,
    weaknessDomains: result.weaknessDomains,
  });

  console.log('[Step 2] Student score saved:', result.rawScore, '/', result.maxScore);
  return result;
}

export async function step3GenerateAIAnalysis(
  attemptId: string,
  studentName: string,
  studentGrade: string,
  examTitle: string,
  scoreData: Step2StudentScore,
  forceRegenerate: boolean = false
): Promise<Step3AIAnalysis> {
  console.log('[Step 3] Generating AI analysis for:', studentName);

  if (!forceRegenerate) {
    const [existing] = await db.select().from(aiAnalysisData)
      .where(eq(aiAnalysisData.attemptId, attemptId)).limit(1);
    
    if (existing) {
      console.log('[Step 3] Using cached AI analysis');
      return {
        attemptId,
        studentId: existing.studentId,
        examId: existing.examId,
        propensityType: existing.propensityType,
        propensityDescription: existing.propensityDescription,
        overallSummary: existing.overallSummary,
        domainAnalyses: existing.domainAnalyses as any,
        strengthAnalyses: existing.strengthAnalyses as any,
        weaknessAnalyses: existing.weaknessAnalyses as any,
        learningStrategy: existing.learningStrategy as any,
        predictedProgress: existing.predictedProgress as any,
        aiProvider: existing.aiProvider || 'unknown',
      };
    }
  }

  const prompt = buildAIPrompt(studentName, studentGrade, examTitle, scoreData);
  
  let aiResult: any;
  let aiProvider = 'gemini';

  try {
    aiResult = await callGeminiAPI(prompt);
  } catch (error: any) {
    console.log('[Step 3] Gemini failed, trying OpenAI:', error.message);
    try {
      aiResult = await callOpenAIAPI(prompt);
      aiProvider = 'openai';
    } catch (openaiError: any) {
      console.log('[Step 3] OpenAI also failed, using fallback');
      aiResult = generateFallbackAnalysis(studentName, scoreData);
      aiProvider = 'fallback';
    }
  }

  const domainAnalyses = scoreData.domainScores.map(d => ({
    domain: d.domain,
    score: d.percentage,
    scoreText: `취득 ${d.earnedScore}점 / 만점 ${d.maxScore}점 (${d.correctCount}/${d.totalCount}문항 정답)`,
    analysisText: aiResult.domainAnalyses?.[d.domain] || generateDomainAnalysis(d),
    statusColor: d.statusColor,
  }));

  const strengthAnalyses = scoreData.strengthDomains.map(domain => {
    const d = scoreData.domainScores.find(ds => ds.domain === domain)!;
    return {
      name: domain,
      score: d.percentage,
      analysisText: aiResult.strengthAnalyses?.[domain] || 
        `${domain} 영역에서 ${d.percentage}%의 우수한 정답률을 보이며, 해당 영역에 대한 탄탄한 기초 실력을 갖추고 있습니다.`,
    };
  });

  const weaknessAnalyses = scoreData.weaknessDomains.map(domain => {
    const d = scoreData.domainScores.find(ds => ds.domain === domain)!;
    return {
      name: domain,
      score: d.percentage,
      analysisText: aiResult.weaknessAnalyses?.[domain] || 
        `${domain}에서 ${d.percentage}%로 취약합니다. 해당 영역의 집중적인 학습이 필요합니다.`,
    };
  });

  const currentScore = scoreData.rawScore;
  const predictedProgress = {
    labels: ['현재', '4주 후', '8주 후', '12주 후'],
    values: [
      currentScore,
      Math.min(100, currentScore + 5),
      Math.min(100, currentScore + 10),
      Math.min(100, currentScore + 15),
    ],
  };

  const learningStrategy = aiResult.learningStrategy || [
    {
      stage: '1단계',
      duration: '4주',
      strategy: '약점 영역 집중 공략',
      details: scoreData.weaknessDomains.length > 0 
        ? `${scoreData.weaknessDomains.join(', ')} 영역의 긴 지문 독해 훈련. 매일 2개 지문씩 시간 내에 풀고 오답 분석.`
        : '전체 영역의 기본기 강화. 매일 다양한 유형의 문제를 풀고 오답 분석.',
      expectedResult: '정답률 +10% 상승',
    },
    {
      stage: '2단계',
      duration: '3주',
      strategy: '개념어 적용 훈련',
      details: '약점인 개념어를 실제 기출 문제에 적용하는 훈련.',
      expectedResult: '정답률 +5% 상승',
    },
    {
      stage: '3단계',
      duration: '5주',
      strategy: '종합 실전 대비 및 시간 관리',
      details: '주 2회 실전 모의고사(시간 측정 필수), 오답 문항 심층 분석, 취약 유형 집중 보완',
      expectedResult: '등급 상승 달성',
    },
  ];

  const result: Step3AIAnalysis = {
    attemptId,
    studentId: scoreData.studentId,
    examId: scoreData.examId,
    propensityType: aiResult.propensityType || determinePropensityType(scoreData),
    propensityDescription: aiResult.propensityDescription || 
      `${studentName} 학생은 ${scoreData.strengthDomains.length > 0 ? '강점을 바탕으로 ' : ''}꾸준한 학습을 통해 성장할 수 있는 타입입니다.`,
    overallSummary: aiResult.overallSummary || generateOverallSummary(studentName, scoreData),
    domainAnalyses,
    strengthAnalyses,
    weaknessAnalyses,
    learningStrategy,
    predictedProgress,
    aiProvider,
  };

  if (forceRegenerate) {
    await db.delete(aiAnalysisData).where(eq(aiAnalysisData.attemptId, attemptId));
  }

  await db.insert(aiAnalysisData).values({
    attemptId,
    studentId: result.studentId,
    examId: result.examId,
    propensityType: result.propensityType,
    propensityDescription: result.propensityDescription,
    overallSummary: result.overallSummary,
    domainAnalyses: result.domainAnalyses,
    strengthAnalyses: result.strengthAnalyses,
    weaknessAnalyses: result.weaknessAnalyses,
    learningStrategy: result.learningStrategy,
    predictedProgress: result.predictedProgress,
    aiProvider: result.aiProvider,
  });

  console.log('[Step 3] AI analysis saved, provider:', aiProvider);
  return result;
}

export async function step4GenerateReport(
  attemptId: string,
  studentName: string,
  studentSchool: string,
  studentGrade: string,
  examAnalysis: Step1ExamAnalysis,
  scoreData: Step2StudentScore,
  aiAnalysis: Step3AIAnalysis,
  forceRegenerate: boolean = false
): Promise<{ reportId: string; htmlContent: string }> {
  console.log('[Step 4] Generating final report for:', studentName);

  const reportData = {
    metaVersion: "v2-4step",
    studentInfo: {
      name: studentName,
      school: studentSchool || '미입력',
      date: new Date().toLocaleDateString('ko-KR'),
      level: studentGrade || '고등학생',
    },
    scoreSummary: {
      grade: scoreData.grade,
      rawScore: scoreData.rawScore,
      rawScoreMax: scoreData.maxScore,
      standardScore: Math.round(scoreData.rawScore * 0.94),
      percentile: scoreData.percentile,
    },
    analysis: {
      olgaSummary: aiAnalysis.overallSummary,
      subjectDetails: aiAnalysis.domainAnalyses.map(d => ({
        name: d.domain,
        score: d.score,
        scoreText: d.scoreText,
        analysisText: d.analysisText,
        statusColor: d.statusColor,
      })),
      strengths: aiAnalysis.strengthAnalyses,
      weaknesses: aiAnalysis.weaknessAnalyses,
      propensity: {
        typeTitle: aiAnalysis.propensityType,
        typeDescription: aiAnalysis.propensityDescription,
      },
    },
    charts: {
      radarChartData: {
        labels: scoreData.domainScores.map(d => d.domain),
        student: scoreData.domainScores.map(d => d.percentage),
        average: scoreData.domainScores.map(() => 65),
      },
      barChartData: {
        labels: scoreData.domainScores.map(d => d.domain),
        values: scoreData.domainScores.map(d => d.percentage),
      },
      predictionData: aiAnalysis.predictedProgress,
    },
    learningStrategy: aiAnalysis.learningStrategy,
  };

  const htmlContent = generateReportHTML(reportData);
  console.log('[Step 4] HTML generated, length:', htmlContent.length);

  if (forceRegenerate) {
    await db.delete(aiReports).where(eq(aiReports.attemptId, attemptId));
  }

  const [report] = await db.insert(aiReports).values({
    attemptId,
    studentId: scoreData.studentId,
    examId: scoreData.examId,
    analysis: reportData.analysis,
    weakAreas: scoreData.weaknessDomains,
    recommendations: aiAnalysis.learningStrategy,
    expectedGrade: Math.max(1, (scoreData.grade || 5) - 1),
    summary: aiAnalysis.overallSummary,
    htmlContent,
  }).returning();

  console.log('[Step 4] Report saved with ID:', report.id);
  return { reportId: report.id, htmlContent };
}

function buildAIPrompt(studentName: string, studentGrade: string, examTitle: string, scoreData: Step2StudentScore): string {
  const domainSummary = scoreData.domainScores.map(d => 
    `- ${d.domain}: ${d.percentage}% (${d.correctCount}/${d.totalCount}문항)`
  ).join('\n');

  return `당신은 올가교육 수능연구소의 데이터 분석 전문가입니다.
아래 학생의 성적 데이터를 분석하여 JSON 형식으로 응답해주세요.

[학생 정보]
- 이름: ${studentName}
- 학년: ${studentGrade || '고등학생'}
- 시험: ${examTitle}
- 점수: ${scoreData.rawScore}/${scoreData.maxScore}점 (${scoreData.percentile}%)
- 등급: ${scoreData.grade}등급
- 정답: ${scoreData.correctCount}문항 / 오답: ${scoreData.incorrectCount}문항

[영역별 성적]
${domainSummary}

[강점 영역] ${scoreData.strengthDomains.join(', ') || '없음'}
[약점 영역] ${scoreData.weaknessDomains.join(', ') || '없음'}

다음 형식의 JSON으로 응답해주세요:
{
  "propensityType": "학생 성향 유형 (예: 안정적 실력형, 도전적 성장형, 균형 잡힌 발전형 등)",
  "propensityDescription": "학생 성향에 대한 2-3문장 설명",
  "overallSummary": "전체 성적에 대한 종합 분석 3-4문장",
  "domainAnalyses": {
    "영역명": "해당 영역 분석 2-3문장"
  },
  "strengthAnalyses": {
    "영역명": "강점 분석 1-2문장"
  },
  "weaknessAnalyses": {
    "영역명": "약점 분석 및 개선 방향 1-2문장"
  },
  "learningStrategy": [
    {"stage": "1단계", "duration": "4주", "strategy": "전략명", "details": "상세 내용", "expectedResult": "예상 결과"},
    {"stage": "2단계", "duration": "3주", "strategy": "전략명", "details": "상세 내용", "expectedResult": "예상 결과"},
    {"stage": "3단계", "duration": "5주", "strategy": "전략명", "details": "상세 내용", "expectedResult": "예상 결과"}
  ]
}`;
}

async function callGeminiAPI(prompt: string): Promise<any> {
  console.log('[AI] Calling Gemini API...');
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 2000,
      temperature: 0.7,
    },
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[AI] Gemini attempt ${attempt}...`);
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      console.log('[AI] Gemini response length:', text.length);
      return JSON.parse(text);
    } catch (error: any) {
      console.log(`[AI] Gemini attempt ${attempt} failed:`, error.message);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 2000));
      } else {
        throw error;
      }
    }
  }
}

async function callOpenAIAPI(prompt: string): Promise<any> {
  console.log('[AI] Calling OpenAI API...');
  const openai = getOpenAIClient();
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { 
        role: "system", 
        content: "You are an educational AI that analyzes Korean student exam results. Always respond in valid JSON format with Korean text." 
      },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2000,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || "{}";
  console.log('[AI] OpenAI response length:', content.length);
  return JSON.parse(content);
}

function generateFallbackAnalysis(studentName: string, scoreData: Step2StudentScore): any {
  const hasStrengths = scoreData.strengthDomains.length > 0;
  const hasWeaknesses = scoreData.weaknessDomains.length > 0;
  
  return {
    propensityType: hasStrengths && !hasWeaknesses ? "안정적 실력형" :
                    hasWeaknesses && !hasStrengths ? "성장 가능형" : "균형 잡힌 발전형",
    propensityDescription: `${studentName} 학생은 ${hasStrengths ? scoreData.strengthDomains.join(', ') + ' 영역에서 강점을 보이며 ' : ''}체계적인 학습을 통해 더욱 성장할 수 있습니다.`,
    overallSummary: `${studentName} 학생은 전체적으로 ${scoreData.rawScore}점(${scoreData.percentile}%)을 기록하며 ${scoreData.grade}등급에 해당합니다. ` +
      (hasStrengths ? `${scoreData.strengthDomains.join(', ')}에서 우수한 성과를 보였고, ` : '') +
      (hasWeaknesses ? `${scoreData.weaknessDomains.join(', ')}에서 보완이 필요합니다.` : '전반적으로 양호한 수준입니다.'),
  };
}

function generateDomainAnalysis(d: Step2StudentScore['domainScores'][0]): string {
  if (d.percentage >= 90) return `${d.domain} 영역에서 ${d.percentage}%의 뛰어난 성취도를 보였습니다. 이 영역의 탄탄한 기초가 확인됩니다.`;
  if (d.percentage >= 80) return `${d.domain} 영역에서 ${d.percentage}%의 우수한 정답률을 기록했습니다.`;
  if (d.percentage >= 70) return `${d.domain} 영역에서 ${d.percentage}%로 양호한 수준이며, 조금 더 연습하면 더 높은 점수가 가능합니다.`;
  if (d.percentage >= 60) return `${d.domain} 영역에서 ${d.percentage}%를 기록하였습니다. 기본 개념 이해에 대한 보완이 필요합니다.`;
  return `${d.domain} 영역에서 ${d.percentage}%로 취약한 모습을 보였습니다. 집중적인 학습이 필요합니다.`;
}

function determinePropensityType(scoreData: Step2StudentScore): string {
  const avgScore = scoreData.percentile;
  const hasStrengths = scoreData.strengthDomains.length > 0;
  const hasWeaknesses = scoreData.weaknessDomains.length > 0;
  
  if (avgScore >= 85 && !hasWeaknesses) return "안정적 실력형";
  if (hasStrengths && hasWeaknesses) return "도전적 성장형";
  if (avgScore >= 70 && !hasWeaknesses) return "균형 잡힌 발전형";
  if (hasWeaknesses && !hasStrengths) return "잠재력 발굴형";
  return "성실한 학습형";
}

function generateOverallSummary(studentName: string, scoreData: Step2StudentScore): string {
  const parts = [
    `${studentName} 학생은 전체적으로 ${scoreData.rawScore}점을 기록하며 ${scoreData.grade}등급에 해당합니다.`
  ];
  
  if (scoreData.strengthDomains.length > 0) {
    parts.push(`${scoreData.strengthDomains.join('과 ')}에서 우수한 성과를 보였습니다.`);
  }
  
  if (scoreData.weaknessDomains.length > 0) {
    parts.push(`${scoreData.weaknessDomains.join('과 ')}에서는 보완이 필요하며, 이들 영역의 집중적인 학습이 권장됩니다.`);
  }
  
  return parts.join(' ');
}
