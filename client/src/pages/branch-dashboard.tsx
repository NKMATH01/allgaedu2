import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { 
  Users, FileText, BarChart3, Plus, Loader2, 
  LogOut, School, Sparkles, BookOpen
} from "lucide-react";
import { useState } from "react";

interface Student {
  id: string;
  userId: string;
  school: string | null;
  grade: string | null;
  user: {
    id: string;
    name: string;
    username: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
  };
}

interface Distribution {
  id: string;
  examId: string;
  branchId: string;
  startDate: string;
  endDate: string;
  exam: {
    id: string;
    title: string;
    subject: string;
    grade: string | null;
    totalQuestions: number;
  };
}

export default function BranchDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newStudentOpen, setNewStudentOpen] = useState(false);

  const { data: stats } = useQuery<{ students: number; classes: number; distributions: number }>({
    queryKey: ["/api/branch/stats"],
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const { data: distributions = [] } = useQuery<Distribution[]>({
    queryKey: ["/api/distributions"],
  });

  const createStudentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/stats"] });
      setNewStudentOpen(false);
      toast({ title: "학생 등록 완료", description: "새 학생이 등록되었습니다." });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message || "학생 등록에 실패했습니다.", variant: "destructive" });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (attemptId: string) => {
      const response = await apiRequest("POST", `/api/reports/generate/${attemptId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "AI 리포트 생성 완료", description: "학생 분석 리포트가 생성되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "리포트 생성에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleCreateStudent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createStudentMutation.mutate({
      username: formData.get("username"),
      password: formData.get("password"),
      name: formData.get("name"),
      role: "student",
      email: formData.get("email"),
      phone: formData.get("phone"),
      school: formData.get("school"),
      grade: formData.get("grade"),
      branchId: user?.branchId,
    });
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
              <h1 className="font-bold text-lg">OLGA 지점관리</h1>
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
              <CardTitle className="text-sm font-medium">학생 수</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-student-count">
                {stats?.students ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">반 수</CardTitle>
              <BookOpen className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-class-count">
                {stats?.classes ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">배포된 시험</CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-distribution-count">
                {stats?.distributions ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="students" className="space-y-4">
          <TabsList>
            <TabsTrigger value="students" data-testid="tab-students">학생 관리</TabsTrigger>
            <TabsTrigger value="exams" data-testid="tab-exams">시험 관리</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-xl font-semibold">학생 목록</h2>
              <Dialog open={newStudentOpen} onOpenChange={setNewStudentOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-student">
                    <Plus className="w-4 h-4 mr-2" />
                    학생 등록
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>새 학생 등록</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateStudent} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="student-username">아이디</Label>
                      <Input id="student-username" name="username" required data-testid="input-student-username" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student-password">비밀번호</Label>
                      <Input id="student-password" name="password" type="password" required data-testid="input-student-password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student-name">이름</Label>
                      <Input id="student-name" name="name" required data-testid="input-student-name" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="student-school">학교</Label>
                        <Input id="student-school" name="school" data-testid="input-student-school" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="student-grade">학년</Label>
                        <Input id="student-grade" name="grade" placeholder="예: 고2" data-testid="input-student-grade" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student-phone">연락처</Label>
                      <Input id="student-phone" name="phone" data-testid="input-student-phone" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student-email">이메일</Label>
                      <Input id="student-email" name="email" type="email" data-testid="input-student-email" />
                    </div>
                    <Button type="submit" className="w-full" disabled={createStudentMutation.isPending} data-testid="button-submit-student">
                      {createStudentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "등록"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((student) => (
                <Card key={student.id} data-testid={`card-student-${student.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{student.user.name}</CardTitle>
                      <Badge variant={student.user.isActive ? "default" : "secondary"}>
                        {student.user.isActive ? "활성" : "비활성"}
                      </Badge>
                    </div>
                    <CardDescription>@{student.user.username}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {student.school && <p>{student.school}</p>}
                    {student.grade && <p>{student.grade}</p>}
                    {student.user.phone && <p>{student.user.phone}</p>}
                  </CardContent>
                </Card>
              ))}
              {students.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    등록된 학생이 없습니다.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="exams" className="space-y-4">
            <h2 className="text-xl font-semibold">배포된 시험</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {distributions.map((dist) => (
                <Card key={dist.id} data-testid={`card-distribution-${dist.id}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{dist.exam.title}</CardTitle>
                    <CardDescription>
                      {dist.exam.subject} {dist.exam.grade && `| ${dist.exam.grade}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{dist.exam.totalQuestions}문항</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(dist.startDate).toLocaleDateString("ko-KR")} ~ {new Date(dist.endDate).toLocaleDateString("ko-KR")}
                    </p>
                  </CardContent>
                </Card>
              ))}
              {distributions.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    배포된 시험이 없습니다.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
