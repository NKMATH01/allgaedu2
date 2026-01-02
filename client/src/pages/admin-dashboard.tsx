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
  Building2, Users, FileText, BarChart3, Plus, Loader2, 
  LogOut, Upload, Settings, School
} from "lucide-react";
import { useState } from "react";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  managerName: string | null;
  isActive: boolean;
  displayOrder: number;
}

interface Exam {
  id: string;
  title: string;
  subject: string;
  grade: string | null;
  totalQuestions: number;
  totalScore: number;
  createdAt: string;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newBranchOpen, setNewBranchOpen] = useState(false);
  const [newExamOpen, setNewExamOpen] = useState(false);

  const { data: stats } = useQuery<{ branches: number; students: number; exams: number; attempts: number }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: exams = [] } = useQuery<Exam[]>({
    queryKey: ["/api/exams"],
  });

  const createBranchMutation = useMutation({
    mutationFn: async (data: { name: string; address?: string; phone?: string; managerName?: string }) => {
      const response = await apiRequest("POST", "/api/branches", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setNewBranchOpen(false);
      toast({ title: "지점 생성 완료", description: "새 지점이 생성되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "지점 생성에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleCreateBranch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createBranchMutation.mutate({
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      phone: formData.get("phone") as string,
      managerName: formData.get("managerName") as string,
    });
  };

  const handleCreateExam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch("/api/exams", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to create exam");
      
      queryClient.invalidateQueries({ queryKey: ["/api/exams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setNewExamOpen(false);
      toast({ title: "시험 생성 완료", description: "새 시험이 생성되었습니다." });
    } catch (error) {
      toast({ title: "오류", description: "시험 생성에 실패했습니다.", variant: "destructive" });
    }
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
              <h1 className="font-bold text-lg">OLGA 관리자</h1>
              <p className="text-sm text-muted-foreground">{user?.name}님</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} data-testid="button-logout">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">지점 수</CardTitle>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-branch-count">
                {stats?.branches ?? 0}
              </div>
            </CardContent>
          </Card>
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
              <CardTitle className="text-sm font-medium">시험 수</CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-exam-count">
                {stats?.exams ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">응시 수</CardTitle>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-attempt-count">
                {stats?.attempts ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="branches" className="space-y-4">
          <TabsList>
            <TabsTrigger value="branches" data-testid="tab-branches">지점 관리</TabsTrigger>
            <TabsTrigger value="exams" data-testid="tab-exams">시험 관리</TabsTrigger>
          </TabsList>

          <TabsContent value="branches" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-xl font-semibold">지점 목록</h2>
              <Dialog open={newBranchOpen} onOpenChange={setNewBranchOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-branch">
                    <Plus className="w-4 h-4 mr-2" />
                    지점 추가
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>새 지점 추가</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateBranch} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="branch-name">지점명</Label>
                      <Input id="branch-name" name="name" required data-testid="input-branch-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-address">주소</Label>
                      <Input id="branch-address" name="address" data-testid="input-branch-address" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-phone">전화번호</Label>
                      <Input id="branch-phone" name="phone" data-testid="input-branch-phone" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="branch-manager">원장명</Label>
                      <Input id="branch-manager" name="managerName" data-testid="input-branch-manager" />
                    </div>
                    <Button type="submit" className="w-full" disabled={createBranchMutation.isPending} data-testid="button-submit-branch">
                      {createBranchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "추가"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((branch) => (
                <Card key={branch.id} data-testid={`card-branch-${branch.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{branch.name}</CardTitle>
                      <Badge variant={branch.isActive ? "default" : "secondary"}>
                        {branch.isActive ? "운영중" : "비활성"}
                      </Badge>
                    </div>
                    {branch.managerName && (
                      <CardDescription>원장: {branch.managerName}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {branch.address && <p>{branch.address}</p>}
                    {branch.phone && <p>{branch.phone}</p>}
                  </CardContent>
                </Card>
              ))}
              {branches.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    등록된 지점이 없습니다.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="exams" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-xl font-semibold">시험 목록</h2>
              <Dialog open={newExamOpen} onOpenChange={setNewExamOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-exam">
                    <Plus className="w-4 h-4 mr-2" />
                    시험 추가
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>새 시험 추가</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateExam} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="exam-title">시험명</Label>
                      <Input id="exam-title" name="title" required data-testid="input-exam-title" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exam-subject">과목</Label>
                      <Input id="exam-subject" name="subject" required data-testid="input-exam-subject" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exam-grade">학년</Label>
                      <Input id="exam-grade" name="grade" placeholder="예: 고3" data-testid="input-exam-grade" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exam-description">설명</Label>
                      <Input id="exam-description" name="description" data-testid="input-exam-description" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exam-file">문제 파일 (Excel)</Label>
                      <Input id="exam-file" name="file" type="file" accept=".xlsx,.xls" required data-testid="input-exam-file" />
                      <p className="text-xs text-muted-foreground">
                        엑셀 파일 형식: 문항번호, 정답, 배점, 단원, 개념, 난이도
                      </p>
                    </div>
                    <Button type="submit" className="w-full" data-testid="button-submit-exam">
                      <Upload className="w-4 h-4 mr-2" />
                      업로드 및 생성
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.map((exam) => (
                <Card key={exam.id} data-testid={`card-exam-${exam.id}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{exam.title}</CardTitle>
                    <CardDescription>{exam.subject} {exam.grade && `| ${exam.grade}`}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center gap-4 flex-wrap">
                    <Badge variant="secondary">{exam.totalQuestions}문항</Badge>
                    <Badge variant="secondary">{exam.totalScore}점</Badge>
                  </CardContent>
                </Card>
              ))}
              {exams.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    등록된 시험이 없습니다.
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
