import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Korean grade calculation (1-9 grade system based on percentile)
export function calculateGrade(score: number, maxScore: number): number {
  const percentage = (score / maxScore) * 100;
  
  if (percentage >= 96) return 1;
  if (percentage >= 89) return 2;
  if (percentage >= 77) return 3;
  if (percentage >= 60) return 4;
  if (percentage >= 40) return 5;
  if (percentage >= 23) return 6;
  if (percentage >= 11) return 7;
  if (percentage >= 4) return 8;
  return 9;
}

// Grade exam answers and calculate score
export function gradeExam(
  answers: Record<string, number>,
  questionsData: Array<{ questionNumber?: number; number?: number; correctAnswer: number; score?: number; points?: number }>
): { score: number; maxScore: number; correctCount: number; grade: number } {
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;

  console.log('[gradeExam] Input answers:', JSON.stringify(answers));
  console.log('[gradeExam] Questions count:', questionsData.length);

  for (const question of questionsData) {
    // Handle both score and points field names
    const questionScore = Number(question.score || question.points || 2);
    maxScore += questionScore;
    
    // Handle both questionNumber and number field names
    const qNum = question.questionNumber || question.number;
    const studentAnswer = Number(answers[String(qNum)]);
    const correctAnswer = Number(question.correctAnswer);
    
    console.log(`[gradeExam] Q${qNum}: student=${studentAnswer}, correct=${correctAnswer}, match=${studentAnswer === correctAnswer}`);
    
    if (studentAnswer === correctAnswer) {
      score += questionScore;
      correctCount++;
    }
  }

  const grade = calculateGrade(score, maxScore);

  console.log(`[gradeExam] Result: score=${score}/${maxScore}, correct=${correctCount}, grade=${grade}`);
  return { score, maxScore, correctCount, grade };
}

// Format date for Korean display
export function formatKoreanDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Escape HTML to prevent XSS attacks
export function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Escape for JSON embedding in HTML
export function escapeForJson(obj: any): string {
  const json = JSON.stringify(obj);
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
    .replace(/"/g, '\\u0022');
}
