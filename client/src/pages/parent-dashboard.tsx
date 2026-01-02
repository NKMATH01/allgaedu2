import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { LogOut, School, Star, BarChart3, Loader2 } from "lucide-react";

interface StudentResult {
  id: string;
  examId: string;
  score: number;
  maxScore: number;
  grade: number;
  correctCount: number;
  submittedAt: string;
  exam: {
    id: string;
    title: string;
    subject: string;
    grade: string | null;
    totalQuestions: number;
    totalScore: number;
  };
  report?: {
    id: string;
    summary: string;
    weakAreas: string[];
    recommendations: string[];
    expectedGrade: number;
  };
}

export default function ParentDashboard() {
  const { user, logout } = useAuth();

  const { data: results = [], isLoading } = useQuery<StudentResult[]>({
    queryKey: ["/api/student/results"],
  });

  const getGradeColor = (grade: number) => {
    if (grade <= 2) return "text-green-600 dark:text-green-400";
    if (grade <= 4) return "text-blue-600 dark:text-blue-400";
    if (grade <= 6) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const averageGrade = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.grade, 0) / results.length * 10) / 10
    : 0;

  const averageScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + (r.score / r.maxScore * 100), 0) / results.length)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center">
              <School className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">OLGA 학부모 포털</h1>
              <p className="text-sm text-muted-foreground">{user?.name}님</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} data-testid="button-logout">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">응시 시험 수</CardTitle>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-exam-count">
                {results.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">평균 등급</CardTitle>
              <Star className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getGradeColor(Math.round(averageGrade))}`} data-testid="text-avg-grade">
                {averageGrade || "-"}등급
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">평균 점수</CardTitle>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-score">
                {averageScore || "-"}%
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">시험 결과</h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((result) => (
                <Card key={result.id} data-testid={`card-result-${result.id}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{result.exam.title}</CardTitle>
                    <CardDescription>
                      {result.exam.subject} | {new Date(result.submittedAt).toLocaleDateString("ko-KR")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">점수</p>
                        <p className="text-xl font-bold">
                          {result.score}/{result.maxScore}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">등급</p>
                        <p className={`text-2xl font-bold ${getGradeColor(result.grade)}`}>
                          {result.grade}등급
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">
                        정답 {result.correctCount}/{result.exam.totalQuestions}
                      </Badge>
                    </div>
                    {result.report && (
                      <div className="p-3 bg-muted rounded-md text-sm space-y-2">
                        <p className="font-medium">AI 분석 요약</p>
                        <p className="text-muted-foreground">{result.report.summary}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {results.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    아직 응시한 시험이 없습니다.
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
