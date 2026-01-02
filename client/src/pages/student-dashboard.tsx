import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { 
  FileText, BarChart3, Loader2, LogOut, School, 
  CheckCircle2, Clock, Play, Star
} from "lucide-react";
import { useState } from "react";

interface AvailableExam {
  id: string;
  examId: string;
  startDate: string;
  endDate: string;
  attempted: boolean;
  exam: {
    id: string;
    title: string;
    subject: string;
    grade: string | null;
    totalQuestions: number;
    totalScore: number;
    questionsData: Array<{
      questionNumber: number;
      correctAnswer: number;
      score: number;
      topic: string;
      concept: string;
      difficulty: string;
    }>;
  };
  attempt?: {
    id: string;
    score: number;
    maxScore: number;
    grade: number;
    correctCount: number;
  };
}

interface ExamResult {
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

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedExam, setSelectedExam] = useState<AvailableExam | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [viewingResult, setViewingResult] = useState<ExamResult | null>(null);

  const { data: availableExams = [], isLoading: examsLoading } = useQuery<AvailableExam[]>({
    queryKey: ["/api/student/exams"],
  });

  const { data: results = [], isLoading: resultsLoading } = useQuery<ExamResult[]>({
    queryKey: ["/api/student/results"],
  });

  const submitMutation = useMutation({
    mutationFn: async ({ examId, distributionId, answers }: { examId: string; distributionId: string; answers: Record<string, number> }) => {
      const response = await apiRequest("POST", `/api/exams/${examId}/submit`, {
        distributionId,
        answers,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/exams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student/results"] });
      setSelectedExam(null);
      setAnswers({});
      toast({ title: "시험 제출 완료", description: "답안이 제출되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "시험 제출에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleStartExam = (exam: AvailableExam) => {
    setSelectedExam(exam);
    setAnswers({});
  };

  const handleSubmitExam = () => {
    if (!selectedExam) return;
    
    const unanswered = selectedExam.exam.questionsData.filter(
      (q) => !answers[String(q.questionNumber)]
    );
    
    if (unanswered.length > 0) {
      const confirm = window.confirm(`${unanswered.length}개 문항이 미응답입니다. 제출하시겠습니까?`);
      if (!confirm) return;
    }

    submitMutation.mutate({
      examId: selectedExam.exam.id,
      distributionId: selectedExam.id,
      answers,
    });
  };

  const getGradeColor = (grade: number) => {
    if (grade <= 2) return "text-green-600 dark:text-green-400";
    if (grade <= 4) return "text-blue-600 dark:text-blue-400";
    if (grade <= 6) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center">
              <School className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">OLGA 학생 포털</h1>
              <p className="text-sm text-muted-foreground">{user?.name}님</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} data-testid="button-logout">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Tabs defaultValue="exams" className="space-y-4">
          <TabsList>
            <TabsTrigger value="exams" data-testid="tab-exams">
              <FileText className="w-4 h-4 mr-2" />
              시험 응시
            </TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results">
              <BarChart3 className="w-4 h-4 mr-2" />
              성적 확인
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams" className="space-y-4">
            <h2 className="text-xl font-semibold">응시 가능한 시험</h2>
            {examsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableExams.map((exam) => (
                  <Card key={exam.id} data-testid={`card-exam-${exam.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{exam.exam.title}</CardTitle>
                        {exam.attempted ? (
                          <Badge variant="secondary">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            완료
                          </Badge>
                        ) : (
                          <Badge>
                            <Clock className="w-3 h-3 mr-1" />
                            대기중
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {exam.exam.subject} {exam.exam.grade && `| ${exam.exam.grade}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{exam.exam.totalQuestions}문항</Badge>
                        <Badge variant="secondary">{exam.exam.totalScore}점</Badge>
                      </div>
                      {exam.attempted && exam.attempt ? (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium">
                            점수: {exam.attempt.score}/{exam.attempt.maxScore}
                          </p>
                          <p className={`text-lg font-bold ${getGradeColor(exam.attempt.grade)}`}>
                            {exam.attempt.grade}등급
                          </p>
                        </div>
                      ) : (
                        <Button 
                          className="w-full" 
                          onClick={() => handleStartExam(exam)}
                          data-testid={`button-start-exam-${exam.id}`}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          시험 시작
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {availableExams.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      현재 응시 가능한 시험이 없습니다.
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            <h2 className="text-xl font-semibold">시험 결과</h2>
            {resultsLoading ? (
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
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setViewingResult(result)}
                          data-testid={`button-view-report-${result.id}`}
                        >
                          <Star className="w-4 h-4 mr-2" />
                          AI 분석 보기
                        </Button>
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
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!selectedExam} onOpenChange={() => setSelectedExam(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedExam?.exam.title}</DialogTitle>
          </DialogHeader>
          {selectedExam && (
            <div className="space-y-6">
              <p className="text-muted-foreground">
                {selectedExam.exam.subject} | {selectedExam.exam.totalQuestions}문항 | {selectedExam.exam.totalScore}점
              </p>
              
              {selectedExam.exam.questionsData.map((question) => (
                <div key={question.questionNumber} className="space-y-3 p-4 bg-muted rounded-md">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="font-medium">
                      {question.questionNumber}번 ({question.score}점)
                    </Label>
                    <Badge variant="outline" size="sm">{question.difficulty}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {question.topic} - {question.concept}
                  </p>
                  <RadioGroup
                    value={String(answers[String(question.questionNumber)] || "")}
                    onValueChange={(value) => 
                      setAnswers(prev => ({ ...prev, [String(question.questionNumber)]: parseInt(value) }))
                    }
                    className="flex gap-4 flex-wrap"
                  >
                    {[1, 2, 3, 4, 5].map((num) => (
                      <div key={num} className="flex items-center gap-2">
                        <RadioGroupItem 
                          value={String(num)} 
                          id={`q${question.questionNumber}-${num}`}
                          data-testid={`radio-q${question.questionNumber}-${num}`}
                        />
                        <Label htmlFor={`q${question.questionNumber}-${num}`}>{num}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}

              <div className="flex gap-4 sticky bottom-0 bg-background pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedExam(null)} className="flex-1">
                  취소
                </Button>
                <Button 
                  onClick={handleSubmitExam} 
                  className="flex-1"
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-exam"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "제출하기"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingResult} onOpenChange={() => setViewingResult(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI 학습 분석 리포트</DialogTitle>
          </DialogHeader>
          {viewingResult?.report && (
            <div className="space-y-6">
              <div className="p-4 bg-muted rounded-md">
                <h3 className="font-semibold mb-2">요약</h3>
                <p>{viewingResult.report.summary}</p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">취약 영역</h3>
                <ul className="list-disc list-inside space-y-1">
                  {viewingResult.report.weakAreas?.map((area, i) => (
                    <li key={i} className="text-muted-foreground">{area}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">학습 추천</h3>
                <ul className="list-disc list-inside space-y-1">
                  {viewingResult.report.recommendations?.map((rec, i) => (
                    <li key={i} className="text-muted-foreground">{rec}</li>
                  ))}
                </ul>
              </div>
              
              <div className="p-4 bg-primary/10 rounded-md text-center">
                <p className="text-sm text-muted-foreground">예상 다음 시험 등급</p>
                <p className={`text-3xl font-bold ${getGradeColor(viewingResult.report.expectedGrade)}`}>
                  {viewingResult.report.expectedGrade}등급
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
