import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(), // admin, branch, student, parent
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  branchId: varchar('branch_id', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Branches table
export const branches = pgTable('branches', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  managerName: text('manager_name'),
  displayOrder: integer('display_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Classes table
export const classes = pgTable('classes', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  branchId: varchar('branch_id', { length: 255 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
  grade: text('grade'),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Students table
export const students = pgTable('students', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id', { length: 255 }).notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  branchId: varchar('branch_id', { length: 255 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
  school: text('school'),
  grade: text('grade'),
  parentPhone: text('parent_phone'),
  enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
});

// Parents table
export const parents = pgTable('parents', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id', { length: 255 }).notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  branchId: varchar('branch_id', { length: 255 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
});

// Student-Parents relationship table
export const studentParents = pgTable('student_parents', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar('student_id', { length: 255 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  parentId: varchar('parent_id', { length: 255 }).notNull().references(() => parents.id, { onDelete: 'cascade' }),
});

// Student-Classes relationship table
export const studentClasses = pgTable('student_classes', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar('student_id', { length: 255 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  classId: varchar('class_id', { length: 255 }).notNull().references(() => classes.id, { onDelete: 'cascade' }),
  enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
});

// Exams table
export const exams = pgTable('exams', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  grade: text('grade'),
  description: text('description'),
  totalQuestions: integer('total_questions').notNull(),
  totalScore: integer('total_score').notNull(),
  examFileUrl: text('exam_file_url'),
  questionsData: json('questions_data').notNull(), // Array of question metadata
  examTrends: json('exam_trends'), // Array of exam trends
  overallReview: text('overall_review'),
  createdBy: varchar('created_by', { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Exam Distributions table
export const examDistributions: any = pgTable('exam_distributions', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar('exam_id', { length: 255 }).notNull().references(() => exams.id, { onDelete: 'cascade' }),
  branchId: varchar('branch_id', { length: 255 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
  classId: varchar('class_id', { length: 255 }).references(() => classes.id, { onDelete: 'cascade' }),
  parentDistributionId: varchar('parent_distribution_id', { length: 255 }),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  distributedBy: varchar('distributed_by', { length: 255 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Distribution Students table (for student-specific distributions)
export const distributionStudents = pgTable('distribution_students', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  distributionId: varchar('distribution_id', { length: 255 }).notNull().references(() => examDistributions.id, { onDelete: 'cascade' }),
  studentId: varchar('student_id', { length: 255 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Exam Attempts table
export const examAttempts = pgTable('exam_attempts', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar('exam_id', { length: 255 }).notNull().references(() => exams.id, { onDelete: 'cascade' }),
  studentId: varchar('student_id', { length: 255 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  distributionId: varchar('distribution_id', { length: 255 }).notNull().references(() => examDistributions.id, { onDelete: 'cascade' }),
  answers: json('answers').notNull(), // { "1": 3, "2": 1, ... }
  score: integer('score'),
  maxScore: integer('max_score'),
  grade: integer('grade'), // 1-9
  correctCount: integer('correct_count'), // Number of correct answers
  startedAt: timestamp('started_at').defaultNow().notNull(),
  submittedAt: timestamp('submitted_at'),
  gradedAt: timestamp('graded_at'),
});

// AI Reports table
export const aiReports = pgTable('ai_reports', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  attemptId: varchar('attempt_id', { length: 255 }).notNull().unique().references(() => examAttempts.id, { onDelete: 'cascade' }),
  studentId: varchar('student_id', { length: 255 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  examId: varchar('exam_id', { length: 255 }).notNull().references(() => exams.id, { onDelete: 'cascade' }),
  analysis: json('analysis'), // AI analysis data
  weakAreas: json('weak_areas'), // Array of weak areas
  recommendations: json('recommendations'), // Array of recommendations
  expectedGrade: integer('expected_grade'),
  summary: text('summary'),
  htmlContent: text('html_content'), // Full HTML report
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

// Step 1: 시험지 분석 데이터 (Exam Analysis Data)
export const examAnalysisData = pgTable('exam_analysis_data', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  examId: varchar('exam_id', { length: 255 }).notNull().references(() => exams.id, { onDelete: 'cascade' }),
  totalQuestions: integer('total_questions').notNull(),
  totalScore: integer('total_score').notNull(),
  domainBreakdown: json('domain_breakdown').notNull(), // 영역별 문항수/배점 분포
  difficultyBreakdown: json('difficulty_breakdown').notNull(), // 난이도별 문항 분포
  questionTypeBreakdown: json('question_type_breakdown').notNull(), // 유형별 문항 분포
  examCharacteristics: json('exam_characteristics'), // 시험 특성 분석
  analyzedAt: timestamp('analyzed_at').defaultNow().notNull(),
});

// Step 2: 학생 성적 데이터 (Student Score Data)
export const studentScoreData = pgTable('student_score_data', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  attemptId: varchar('attempt_id', { length: 255 }).notNull().unique().references(() => examAttempts.id, { onDelete: 'cascade' }),
  studentId: varchar('student_id', { length: 255 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  examId: varchar('exam_id', { length: 255 }).notNull().references(() => exams.id, { onDelete: 'cascade' }),
  rawScore: integer('raw_score').notNull(),
  maxScore: integer('max_score').notNull(),
  percentile: integer('percentile'), // 백분위
  grade: integer('grade'), // 1-9등급
  correctCount: integer('correct_count').notNull(),
  incorrectCount: integer('incorrect_count').notNull(),
  domainScores: json('domain_scores').notNull(), // 영역별 점수/정답률
  difficultyScores: json('difficulty_scores').notNull(), // 난이도별 정답률
  incorrectQuestions: json('incorrect_questions').notNull(), // 오답 문항 상세
  correctQuestions: json('correct_questions').notNull(), // 정답 문항 상세
  strengthDomains: json('strength_domains').notNull(), // 강점 영역 (≥80%)
  weaknessDomains: json('weakness_domains').notNull(), // 약점 영역 (<60%)
  calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
});

// Step 3: AI 분석 데이터 (AI Analysis Data)
export const aiAnalysisData = pgTable('ai_analysis_data', {
  id: varchar('id', { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
  attemptId: varchar('attempt_id', { length: 255 }).notNull().unique().references(() => examAttempts.id, { onDelete: 'cascade' }),
  studentId: varchar('student_id', { length: 255 }).notNull().references(() => students.id, { onDelete: 'cascade' }),
  examId: varchar('exam_id', { length: 255 }).notNull().references(() => exams.id, { onDelete: 'cascade' }),
  propensityType: text('propensity_type').notNull(), // 학생 성향 유형
  propensityDescription: text('propensity_description').notNull(), // 성향 설명
  overallSummary: text('overall_summary').notNull(), // 총평
  domainAnalyses: json('domain_analyses').notNull(), // 영역별 상세 분석 텍스트
  strengthAnalyses: json('strength_analyses').notNull(), // 강점 영역 분석
  weaknessAnalyses: json('weakness_analyses').notNull(), // 약점 영역 분석
  learningStrategy: json('learning_strategy').notNull(), // 12주 학습 전략
  predictedProgress: json('predicted_progress').notNull(), // 예상 성적 향상
  aiProvider: text('ai_provider'), // gemini or openai
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  branch: one(branches, {
    fields: [users.branchId],
    references: [branches.id],
  }),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  classes: many(classes),
  students: many(students),
  parents: many(parents),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [students.branchId],
    references: [branches.id],
  }),
  attempts: many(examAttempts),
  reports: many(aiReports),
  parents: many(studentParents),
  classes: many(studentClasses),
}));

export const parentsRelations = relations(parents, ({ one, many }) => ({
  user: one(users, {
    fields: [parents.userId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [parents.branchId],
    references: [branches.id],
  }),
  students: many(studentParents),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  branch: one(branches, {
    fields: [classes.branchId],
    references: [branches.id],
  }),
  students: many(studentClasses),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
  creator: one(users, {
    fields: [exams.createdBy],
    references: [users.id],
  }),
  distributions: many(examDistributions),
  attempts: many(examAttempts),
  reports: many(aiReports),
}));

export const examDistributionsRelations = relations(examDistributions, ({ one, many }) => ({
  exam: one(exams, {
    fields: [examDistributions.examId],
    references: [exams.id],
  }),
  branch: one(branches, {
    fields: [examDistributions.branchId],
    references: [branches.id],
  }),
  class: one(classes, {
    fields: [examDistributions.classId],
    references: [classes.id],
  }),
  distributor: one(users, {
    fields: [examDistributions.distributedBy],
    references: [users.id],
  }),
  attempts: many(examAttempts),
  students: many(distributionStudents),
}));

export const distributionStudentsRelations = relations(distributionStudents, ({ one }) => ({
  distribution: one(examDistributions, {
    fields: [distributionStudents.distributionId],
    references: [examDistributions.id],
  }),
  student: one(students, {
    fields: [distributionStudents.studentId],
    references: [students.id],
  }),
}));

export const studentParentsRelations = relations(studentParents, ({ one }) => ({
  student: one(students, {
    fields: [studentParents.studentId],
    references: [students.id],
  }),
  parent: one(parents, {
    fields: [studentParents.parentId],
    references: [parents.id],
  }),
}));

export const studentClassesRelations = relations(studentClasses, ({ one }) => ({
  student: one(students, {
    fields: [studentClasses.studentId],
    references: [students.id],
  }),
  class: one(classes, {
    fields: [studentClasses.classId],
    references: [classes.id],
  }),
}));

export const examAttemptsRelations = relations(examAttempts, ({ one }) => ({
  exam: one(exams, {
    fields: [examAttempts.examId],
    references: [exams.id],
  }),
  student: one(students, {
    fields: [examAttempts.studentId],
    references: [students.id],
  }),
  distribution: one(examDistributions, {
    fields: [examAttempts.distributionId],
    references: [examDistributions.id],
  }),
  report: one(aiReports, {
    fields: [examAttempts.id],
    references: [aiReports.attemptId],
  }),
}));

export const aiReportsRelations = relations(aiReports, ({ one }) => ({
  attempt: one(examAttempts, {
    fields: [aiReports.attemptId],
    references: [examAttempts.id],
  }),
  student: one(students, {
    fields: [aiReports.studentId],
    references: [students.id],
  }),
  exam: one(exams, {
    fields: [aiReports.examId],
    references: [exams.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBranchSchema = createInsertSchema(branches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, enrollmentDate: true });
export const insertParentSchema = createInsertSchema(parents).omit({ id: true });
export const insertExamSchema = createInsertSchema(exams).omit({ id: true, createdAt: true });
export const insertExamDistributionSchema = createInsertSchema(examDistributions).omit({ id: true, createdAt: true });
export const insertExamAttemptSchema = createInsertSchema(examAttempts).omit({ id: true, startedAt: true });
export const insertAiReportSchema = createInsertSchema(aiReports).omit({ id: true, generatedAt: true });
export const insertExamAnalysisDataSchema = createInsertSchema(examAnalysisData).omit({ id: true, analyzedAt: true });
export const insertStudentScoreDataSchema = createInsertSchema(studentScoreData).omit({ id: true, calculatedAt: true });
export const insertAiAnalysisDataSchema = createInsertSchema(aiAnalysisData).omit({ id: true, generatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Parent = typeof parents.$inferSelect;
export type InsertParent = z.infer<typeof insertParentSchema>;
export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;
export type ExamDistribution = typeof examDistributions.$inferSelect;
export type InsertExamDistribution = z.infer<typeof insertExamDistributionSchema>;
export type ExamAttempt = typeof examAttempts.$inferSelect;
export type InsertExamAttempt = z.infer<typeof insertExamAttemptSchema>;
export type AiReport = typeof aiReports.$inferSelect;
export type InsertAiReport = z.infer<typeof insertAiReportSchema>;
export type StudentParent = typeof studentParents.$inferSelect;
export type StudentClass = typeof studentClasses.$inferSelect;
export type DistributionStudent = typeof distributionStudents.$inferSelect;
export type ExamAnalysisData = typeof examAnalysisData.$inferSelect;
export type InsertExamAnalysisData = z.infer<typeof insertExamAnalysisDataSchema>;
export type StudentScoreData = typeof studentScoreData.$inferSelect;
export type InsertStudentScoreData = z.infer<typeof insertStudentScoreDataSchema>;
export type AiAnalysisData = typeof aiAnalysisData.$inferSelect;
export type InsertAiAnalysisData = z.infer<typeof insertAiAnalysisDataSchema>;

// Re-export chat models for AI integration
export * from "./models/chat";
