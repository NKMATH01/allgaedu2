import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Users, GraduationCap, FileText, LogOut, ChevronDown, ChevronRight, 
  Plus, Trash2, Edit, Sparkles, Search, User, BookOpen, ClipboardList
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  branchId?: string;
}

type TopMenu = 'misudeung' | 'manage';
type ManageMenu = 'students' | 'classes' | 'exams';

export default function BranchDashboard({ user }: { user: User }) {
  const queryClient = useQueryClient();
  
  const [topMenu, setTopMenu] = useState<TopMenu>('misudeung');
  const [manageMenu, setManageMenu] = useState<ManageMenu>('students');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedDistribution, setSelectedDistribution] = useState<any>(null);
  
  const [sortMode, setSortMode] = useState<'grade' | 'class'>('grade');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGrades, setExpandedGrades] = useState<Record<string, boolean>>({});
  const [studentTab, setStudentTab] = useState<'exams' | 'results' | 'reports'>('exams');
  
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [selectedClassStudents, setSelectedClassStudents] = useState<string[]>([]);
  
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);
  
  const [showRedistributeModal, setShowRedistributeModal] = useState(false);
  const [redistributeType, setRedistributeType] = useState<'class' | 'student'>('class');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const { data: students, refetch: refetchStudents } = useQuery({
    queryKey: ['students', user.branchId],
    queryFn: async () => {
      const res = await api.get('/students');
      return res.data.data;
    },
  });

  const { data: classes, refetch: refetchClasses } = useQuery({
    queryKey: ['classes', user.branchId],
    queryFn: async () => {
      const res = await api.get('/classes');
      return res.data.data;
    },
  });

  const { data: distributions } = useQuery({
    queryKey: ['distributions', user.branchId],
    queryFn: async () => {
      const res = await api.get('/distributions');
      return res.data.data;
    },
  });

  const { data: distributionStudents, refetch: refetchDistributionStudents } = useQuery({
    queryKey: ['distribution-students', selectedDistribution?.id],
    queryFn: async () => {
      if (!selectedDistribution?.id) return null;
      const res = await api.get(`/distributions/${selectedDistribution.id}/students`);
      return res.data.data;
    },
    enabled: !!selectedDistribution?.id,
  });

  const { data: allDistributionStudents, refetch: refetchAllDistributionStudents } = useQuery({
    queryKey: ['all-distribution-students', user.branchId],
    queryFn: async () => {
      if (!distributions || distributions.length === 0) return [];
      const allStudents = await Promise.all(
        distributions.map(async (dist: any) => {
          try {
            const res = await api.get(`/distributions/${dist.id}/students`);
            return { distribution: dist, ...res.data.data };
          } catch (error) {
            return null;
          }
        })
      );
      return allStudents.filter(Boolean);
    },
    enabled: !!distributions && distributions.length > 0,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => { await api.post('/auth/logout'); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }); },
  });

  const createStudentMutation = useMutation({
    mutationFn: async (data: any) => { const res = await api.post('/students', data); return res.data; },
    onSuccess: () => { refetchStudents(); setShowStudentModal(false); alert('학생이 등록되었습니다.'); },
    onError: (error: any) => { alert(error.response?.data?.message || '학생 등록에 실패했습니다.'); },
  });

  const updateStudentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const res = await api.put(`/students/${id}`, data); return res.data; },
    onSuccess: () => { refetchStudents(); setShowStudentModal(false); setEditingStudent(null); alert('학생 정보가 수정되었습니다.'); },
    onError: (error: any) => { alert(error.response?.data?.message || '학생 수정에 실패했습니다.'); },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: async (id: string) => { const res = await api.delete(`/students/${id}`); return res.data; },
    onSuccess: () => { refetchStudents(); alert('학생이 삭제되었습니다.'); },
    onError: (error: any) => { alert(error.response?.data?.message || '학생 삭제에 실패했습니다.'); },
  });

  const createClassMutation = useMutation({
    mutationFn: async (data: any) => { const res = await api.post('/classes', data); return res.data; },
    onSuccess: () => { refetchClasses(); setShowClassModal(false); alert('반이 생성되었습니다.'); },
    onError: (error: any) => { alert(error.response?.data?.message || '반 생성에 실패했습니다.'); },
  });

  const updateClassMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const res = await api.put(`/classes/${id}`, data); return res.data; },
    onSuccess: () => { refetchClasses(); setShowClassModal(false); setEditingClass(null); alert('반이 수정되었습니다.'); },
    onError: (error: any) => { alert(error.response?.data?.message || '반 수정에 실패했습니다.'); },
  });

  const deleteClassMutation = useMutation({
    mutationFn: async (id: string) => { const res = await api.delete(`/classes/${id}`); return res.data; },
    onSuccess: () => { refetchClasses(); alert('반이 삭제되었습니다.'); },
    onError: (error: any) => { alert(error.response?.data?.message || '반 삭제에 실패했습니다.'); },
  });

  const redistributeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const res = await api.put(`/distributions/${id}`, data); return res.data; },
    onSuccess: (data) => { 
      queryClient.invalidateQueries({ queryKey: ['distributions', user.branchId] }); 
      setShowRedistributeModal(false); setSelectedDistribution(null); setSelectedClassId(''); setSelectedStudentIds([]);
      alert(data.message || '지점내 배포가 완료되었습니다.'); 
    },
    onError: (error: any) => { alert(error.response?.data?.message || '지점내 배포에 실패했습니다.'); },
  });

  const createAttemptMutation = useMutation({
    mutationFn: async ({ studentId, distributionId }: { studentId: string; distributionId: string }) => {
      const res = await api.post('/exam-attempts/branch-create', { studentId, distributionId });
      return res.data;
    },
    onSuccess: () => { refetchDistributionStudents(); refetchAllDistributionStudents(); },
    onError: (error: any) => { alert(error.response?.data?.message || '답안지 생성에 실패했습니다.'); },
  });

  const gradeAttemptMutation = useMutation({
    mutationFn: async ({ attemptId, answers }: { attemptId: string; answers: any }) => {
      const res = await api.put(`/exam-attempts/${attemptId}/branch-grade`, { answers });
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['distribution-students'] });
      await queryClient.invalidateQueries({ queryKey: ['all-distribution-students'] });
      refetchDistributionStudents(); refetchAllDistributionStudents();
      setShowAnswerModal(false); setSelectedAttempt(null);
      alert('답안이 저장되었습니다.');
    },
    onError: (error: any) => { alert(error.response?.data?.message || '답안 저장에 실패했습니다.'); },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (attemptId: string) => { const res = await api.post(`/reports/generate/${attemptId}`); return res.data; },
    onSuccess: (data) => { refetchDistributionStudents(); refetchAllDistributionStudents(); alert(data.message || 'AI 분석이 완료되었습니다.'); },
    onError: (error: any) => { alert(error.response?.data?.message || 'AI 분석에 실패했습니다.'); },
  });

  const deleteDistributionMutation = useMutation({
    mutationFn: async (distributionId: string) => { const res = await api.delete(`/distributions/${distributionId}`); return res.data; },
    onSuccess: (data) => { 
      queryClient.invalidateQueries({ queryKey: ['distributions', user.branchId] }); 
      setSelectedDistribution(null);
      alert(data.message || '배포가 삭제되었습니다.'); 
    },
    onError: (error: any) => { alert(error.response?.data?.message || '배포 삭제에 실패했습니다.'); },
  });

  const getClassName = (studentId: string) => {
    if (!classes) return null;
    const cls = classes.find((c: any) => c.studentIds?.includes(studentId));
    return cls?.name || null;
  };

  const studentsGrouped = useMemo(() => {
    if (!students) return {};
    
    let filtered = students;
    
    if (searchQuery) {
      filtered = filtered.filter((s: any) => 
        s.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.school?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    const grouped: Record<string, any[]> = {};
    
    if (sortMode === 'grade') {
      filtered.forEach((s: any) => {
        const grade = s.grade || '미지정';
        if (!grouped[grade]) grouped[grade] = [];
        grouped[grade].push(s);
      });
      
      const sortedGrades = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '미지정'];
      const sorted: Record<string, any[]> = {};
      sortedGrades.forEach(g => {
        if (grouped[g]) sorted[g] = grouped[g];
      });
      return sorted;
    } else {
      filtered.forEach((s: any) => {
        const className = getClassName(s.id) || '미배정';
        if (!grouped[className]) grouped[className] = [];
        grouped[className].push(s);
      });
      return grouped;
    }
  }, [students, searchQuery, sortMode, classes]);

  const toggleGradeExpand = (grade: string) => {
    setExpandedGrades(prev => ({ ...prev, [grade]: !prev[grade] }));
  };

  const handleStudentSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: any = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      school: formData.get('school'),
      grade: formData.get('grade'),
      parentPhone: formData.get('parentPhone'),
    };
    if (editingStudent) {
      const password = formData.get('password');
      if (password && password.toString().trim() !== '') data.password = password;
      updateStudentMutation.mutate({ id: editingStudent.id, data });
    } else {
      createStudentMutation.mutate(data);
    }
  };

  const handleClassSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      grade: formData.get('grade'),
      description: formData.get('description'),
      studentIds: selectedClassStudents,
    };
    if (editingClass) {
      updateClassMutation.mutate({ id: editingClass.id, data });
    } else {
      createClassMutation.mutate(data);
    }
  };

  const handleRedistributeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDistribution) return;
    const data: any = {};
    if (redistributeType === 'class') {
      if (!selectedClassId) { alert('반을 선택해주세요.'); return; }
      data.classId = selectedClassId;
    } else {
      if (selectedStudentIds.length === 0) { alert('학생을 선택해주세요.'); return; }
      data.studentIds = selectedStudentIds;
    }
    redistributeMutation.mutate({ id: selectedDistribution.id, data });
  };

  const handleAnswerSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    let totalQuestions = 30;
    if (distributionStudents?.exam?.totalQuestions) {
      totalQuestions = distributionStudents.exam.totalQuestions;
    } else if (selectedAttempt?.distributionId && allDistributionStudents) {
      const distData = allDistributionStudents.find((d: any) => d.distribution.id === selectedAttempt.distributionId);
      if (distData?.exam?.totalQuestions) totalQuestions = distData.exam.totalQuestions;
    }
    const answers: any = {};
    for (let i = 1; i <= totalQuestions; i++) {
      const value = formData.get(`q${i}`);
      if (value !== null && value !== '') answers[i] = parseInt(value.toString());
    }
    if (Object.keys(answers).length === 0) { alert('최소 1개 이상의 답안을 입력해주세요.'); return; }
    if (selectedAttempt.attemptId) {
      gradeAttemptMutation.mutate({ attemptId: selectedAttempt.attemptId, answers });
    } else {
      if (!selectedAttempt.studentId || !selectedAttempt.distributionId) { alert('학생 정보가 올바르지 않습니다.'); return; }
      createAttemptMutation.mutate({ studentId: selectedAttempt.studentId, distributionId: selectedAttempt.distributionId }, {
        onSuccess: (data) => {
          const newAttemptId = data.data?.id || data.id;
          if (newAttemptId) gradeAttemptMutation.mutate({ attemptId: newAttemptId, answers });
          else alert('답안지 생성은 성공했으나 ID를 찾을 수 없습니다.');
        },
      });
    }
  };

  const renderTopNav = () => (
    <header className="h-14 border-b bg-background flex items-center justify-between px-4 sticky top-0 z-50" data-testid="header-branch">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold">NK</span>
          </div>
        </div>
        
        <nav className="flex items-center gap-1">
          <Button
            variant={topMenu === 'misudeung' ? 'default' : 'ghost'}
            onClick={() => setTopMenu('misudeung')}
            className="gap-2"
            data-testid="button-menu-misudeung"
          >
            <ClipboardList className="w-4 h-4" />
            미수등
          </Button>
          <Button
            variant={topMenu === 'manage' ? 'default' : 'ghost'}
            onClick={() => setTopMenu('manage')}
            className="gap-2"
            data-testid="button-menu-manage"
          >
            <Users className="w-4 h-4" />
            관리
          </Button>
        </nav>
      </div>
      
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user.name}</span>
        <Button variant="ghost" size="icon" onClick={() => logoutMutation.mutate()} data-testid="button-logout">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );

  const renderMisudeungSidebar = () => (
    <aside className="w-64 border-r bg-muted/30 flex flex-col h-[calc(100vh-3.5rem)]" data-testid="sidebar-misudeung">
      <div className="p-3 border-b space-y-3">
        {selectedStudent && (
          <div className="flex items-center gap-2 p-2 bg-background rounded-md">
            <User className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium truncate">{selectedStudent.user?.name} 학생 수업</span>
          </div>
        )}
        
        <div className="flex gap-2">
          <Button
            variant={sortMode === 'grade' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setSortMode('grade')}
            data-testid="button-sort-grade"
          >
            학년
          </Button>
          <Button
            variant={sortMode === 'class' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setSortMode('class')}
            data-testid="button-sort-class"
          >
            반
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="학생 이름 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
            data-testid="input-search-student"
          />
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>등록학생 {students?.length || 0}명</span>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {Object.entries(studentsGrouped).map(([groupKey, studentsList]) => (
            <div key={groupKey} className="mb-1">
              <div
                className="w-full flex items-center justify-between p-2 hover-elevate rounded-md text-sm cursor-pointer"
                onClick={() => toggleGradeExpand(groupKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleGradeExpand(groupKey)}
                data-testid={`button-toggle-group-${groupKey}`}
              >
                <div className="flex items-center gap-2">
                  {expandedGrades[groupKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-medium">{groupKey}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{studentsList.length}명</Badge>
              </div>
              
              {expandedGrades[groupKey] && (
                <div className="ml-4 space-y-0.5">
                  {studentsList.map((s: any) => {
                    const clsName = getClassName(s.id);
                    return (
                      <div
                        key={s.id}
                        className={`w-full flex items-center justify-between p-2 rounded-md text-sm hover-elevate cursor-pointer ${
                          selectedStudent?.id === s.id ? 'bg-primary/10 text-primary' : ''
                        }`}
                        onClick={() => setSelectedStudent(s)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedStudent(s)}
                        data-testid={`button-select-student-${s.id}`}
                      >
                        <span className="truncate">
                          {clsName && <span className="text-muted-foreground">{clsName}_</span>}
                          {s.user?.name}
                        </span>
                        <Badge variant="outline" className="text-xs">출석</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          
          {Object.keys(studentsGrouped).length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              등록된 학생이 없습니다.
            </div>
          )}
        </div>
      </ScrollArea>
      
    </aside>
  );

  const renderManageSidebar = () => (
    <aside className="w-56 border-r bg-muted/30 flex flex-col h-[calc(100vh-3.5rem)]" data-testid="sidebar-manage">
      <nav className="p-3 space-y-1">
        <div
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer ${
            manageMenu === 'students' ? 'bg-primary text-primary-foreground' : 'hover-elevate'
          }`}
          onClick={() => setManageMenu('students')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setManageMenu('students')}
          data-testid="button-manage-students"
        >
          <Users className="w-4 h-4" />
          학생 관리
        </div>
        <div
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer ${
            manageMenu === 'classes' ? 'bg-primary text-primary-foreground' : 'hover-elevate'
          }`}
          onClick={() => setManageMenu('classes')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setManageMenu('classes')}
          data-testid="button-manage-classes"
        >
          <GraduationCap className="w-4 h-4" />
          반 관리
        </div>
        <div
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer ${
            manageMenu === 'exams' ? 'bg-primary text-primary-foreground' : 'hover-elevate'
          }`}
          onClick={() => setManageMenu('exams')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setManageMenu('exams')}
          data-testid="button-manage-exams"
        >
          <FileText className="w-4 h-4" />
          시험지 관리
        </div>
      </nav>
    </aside>
  );

  const getStudentExamData = (studentId: string) => {
    if (!allDistributionStudents) return [];
    const results: any[] = [];
    allDistributionStudents.forEach((d: any) => {
      const studentData = d.students?.find((s: any) => s.studentId === studentId);
      if (studentData) {
        results.push({
          ...studentData,
          distribution: d.distribution,
          exam: d.exam,
        });
      }
    });
    return results;
  };

  const renderMisudeungContent = () => {
    const studentExamData = selectedStudent ? getStudentExamData(selectedStudent.student?.id) : [];
    const submittedExams = studentExamData.filter((e: any) => e.isSubmitted || e.submittedAt);
    const examsWithReports = studentExamData.filter((e: any) => e.hasReport);

    return (
      <main className="flex-1 overflow-auto p-6" data-testid="content-misudeung">
        {selectedStudent ? (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{selectedStudent.user?.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedStudent.student?.grade} | {selectedStudent.student?.school}</p>
                </div>
              </div>
            </div>
            
            <div className="border-b mb-6">
              <nav className="flex gap-6">
                <div
                  className={`pb-3 text-sm font-medium border-b-2 cursor-pointer ${studentTab === 'exams' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setStudentTab('exams')}
                  role="button"
                  tabIndex={0}
                  data-testid="tab-exams"
                >
                  배포된 시험지
                </div>
                <div
                  className={`pb-3 text-sm font-medium border-b-2 cursor-pointer ${studentTab === 'results' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setStudentTab('results')}
                  role="button"
                  tabIndex={0}
                  data-testid="tab-results"
                >
                  시험결과
                </div>
                <div
                  className={`pb-3 text-sm font-medium border-b-2 cursor-pointer ${studentTab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setStudentTab('reports')}
                  role="button"
                  tabIndex={0}
                  data-testid="tab-reports"
                >
                  보고서
                </div>
              </nav>
            </div>
            
            {studentTab === 'exams' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">배포된 시험지 ({studentExamData.length}개)</h3>
                {studentExamData.length > 0 ? (
                  <div className="space-y-3">
                    {studentExamData.map((examData: any) => (
                      <Card key={examData.distribution?.id} className="hover-elevate">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{examData.exam?.title || '시험'}</h4>
                            <p className="text-sm text-muted-foreground">
                              {examData.exam?.subject} | {examData.exam?.totalQuestions}문항
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {examData.isSubmitted || examData.submittedAt ? (
                              <Badge variant="secondary">응시 완료</Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedAttempt({
                                    ...examData,
                                    studentId: selectedStudent.student?.id,
                                    distributionId: examData.distribution?.id,
                                  });
                                  setSelectedDistribution(examData.distribution);
                                  setShowAnswerModal(true);
                                }}
                              >
                                답안 입력
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      배포된 시험이 없습니다.
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {studentTab === 'results' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">시험결과 ({submittedExams.length}개)</h3>
                {submittedExams.length > 0 ? (
                  <div className="space-y-3">
                    {submittedExams.map((examData: any) => (
                      <Card key={examData.distribution?.id} className="hover-elevate">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{examData.exam?.title || '시험'}</h4>
                            <p className="text-sm text-muted-foreground">
                              {examData.exam?.subject}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{examData.score}/{examData.maxScore}점</Badge>
                            <Badge>{examData.grade}등급</Badge>
                            {!examData.hasReport && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateReportMutation.mutate(examData.attemptId)}
                                disabled={generateReportMutation.isPending}
                              >
                                <Sparkles className="w-4 h-4 mr-1" />
                                AI 분석
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      아직 응시한 시험이 없습니다.
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {studentTab === 'reports' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">AI 분석 보고서 ({examsWithReports.length}개)</h3>
                {examsWithReports.length > 0 ? (
                  <div className="space-y-3">
                    {examsWithReports.map((examData: any) => (
                      <Card key={examData.distribution?.id} className="hover-elevate">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{examData.exam?.title || '시험'}</h4>
                            <p className="text-sm text-muted-foreground">
                              {examData.score}/{examData.maxScore}점 ({examData.grade}등급)
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">분석 완료</Badge>
                            <Button size="sm" variant="outline">
                              보고서 보기
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      생성된 AI 분석 보고서가 없습니다.
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <User className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>왼쪽 목록에서 학생을 선택하세요.</p>
            </div>
          </div>
        )}
      </main>
    );
  };

  const renderStudentManagement = () => (
    <main className="flex-1 overflow-auto p-6" data-testid="content-students">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Select defaultValue="recent">
            <SelectTrigger className="w-32">
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">최신 등록순</SelectItem>
              <SelectItem value="name">이름순</SelectItem>
              <SelectItem value="grade">학년순</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-1">
            {['전체', '초', '중', '고'].map((label, i) => (
              <Button
                key={label}
                variant={i === 0 ? 'default' : 'outline'}
                size="sm"
              >
                {label}
              </Button>
            ))}
          </div>
          
          <Badge variant="secondary">{students?.length || 0}명</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="이지율" className="pl-8 w-40" data-testid="input-search-manage-student" />
          </div>
          <Button variant="outline" data-testid="button-bulk-register">
            <Plus className="w-4 h-4 mr-1" />
            학생 일괄 등록
          </Button>
          <Button onClick={() => { setEditingStudent(null); setShowStudentModal(true); }} data-testid="button-add-student">
            <Plus className="w-4 h-4 mr-1" />
            학생 개별 등록
          </Button>
        </div>
      </div>
      
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                  <input type="checkbox" className="w-4 h-4" />
                </th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground">학년</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground">성명</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground">학생 이름</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground">학부모 연락처</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground">학부모 ID</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground">학생 ID</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground">학생앱</th>
                <th className="p-3 text-left text-sm font-medium text-muted-foreground">상세</th>
              </tr>
            </thead>
            <tbody>
              {students?.length > 0 ? students.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-muted/50" data-testid={`row-student-${s.id}`}>
                  <td className="p-3"><input type="checkbox" className="w-4 h-4" /></td>
                  <td className="p-3 text-sm">{s.grade || '-'}</td>
                  <td className="p-3 text-sm font-medium">{s.user?.name}</td>
                  <td className="p-3 text-sm">{s.user?.phone || '-'}</td>
                  <td className="p-3 text-sm">{s.parentPhone || '-'}</td>
                  <td className="p-3 text-sm">{s.parentPhone || '-'}</td>
                  <td className="p-3 text-sm">{s.user?.username}</td>
                  <td className="p-3 text-sm">-</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditingStudent(s); setShowStudentModal(true); }}
                        data-testid={`button-edit-student-${s.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('정말 삭제하시겠습니까?')) {
                            deleteStudentMutation.mutate(s.id);
                          }
                        }}
                        data-testid={`button-delete-student-${s.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    총 등록된 학생수가 기본 인원 초과시, 인당 추가 과금이 발생합니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );

  const renderClassManagement = () => (
    <main className="flex-1 overflow-auto p-6" data-testid="content-classes">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">반 관리</h2>
        <Button onClick={() => { setEditingClass(null); setSelectedClassStudents([]); setShowClassModal(true); }} data-testid="button-add-class">
          <Plus className="w-4 h-4 mr-1" />
          반 생성
        </Button>
      </div>
      
      <div className="grid gap-4">
        {classes?.length > 0 ? classes.map((cls: any) => (
          <Card key={cls.id} data-testid={`card-class-${cls.id}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{cls.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{cls.grade} | {cls.studentIds?.length || 0}명</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditingClass(cls);
                    setSelectedClassStudents(cls.studentIds || []);
                    setShowClassModal(true);
                  }}
                  data-testid={`button-edit-class-${cls.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm('정말 삭제하시겠습니까?')) {
                      deleteClassMutation.mutate(cls.id);
                    }
                  }}
                  data-testid={`button-delete-class-${cls.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            {cls.description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{cls.description}</p>
              </CardContent>
            )}
          </Card>
        )) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              등록된 반이 없습니다.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );

  const renderExamManagement = () => (
    <main className="flex-1 overflow-auto p-6" data-testid="content-exams">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">시험지 관리 (배포된 시험)</h2>
      </div>
      
      <div className="grid gap-4">
        {distributions?.length > 0 ? distributions.map((dist: any) => (
          <Card key={dist.id} data-testid={`card-distribution-${dist.id}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{dist.exam?.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {dist.exam?.subject} | {dist.exam?.grade} | {dist.exam?.totalQuestions}문항
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedDistribution(dist);
                    setShowRedistributeModal(true);
                  }}
                  data-testid={`button-redistribute-${dist.id}`}
                >
                  지점내 배포
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedDistribution(dist)}
                  data-testid={`button-view-students-${dist.id}`}
                >
                  학생 목록
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm('정말 삭제하시겠습니까?')) {
                      deleteDistributionMutation.mutate(dist.id);
                    }
                  }}
                  data-testid={`button-delete-distribution-${dist.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        )) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              배포된 시험이 없습니다.
            </CardContent>
          </Card>
        )}
      </div>
      
      {selectedDistribution && distributionStudents && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{selectedDistribution.exam?.title} - 학생 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left text-sm font-medium">이름</th>
                    <th className="p-2 text-left text-sm font-medium">학년</th>
                    <th className="p-2 text-left text-sm font-medium">점수</th>
                    <th className="p-2 text-left text-sm font-medium">등급</th>
                    <th className="p-2 text-left text-sm font-medium">상태</th>
                    <th className="p-2 text-left text-sm font-medium">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {distributionStudents.students?.map((s: any) => (
                    <tr key={s.studentId} className="border-b">
                      <td className="p-2 text-sm">{s.studentName}</td>
                      <td className="p-2 text-sm">{s.schoolGrade}</td>
                      <td className="p-2 text-sm">{s.score !== null ? `${s.score}/${s.maxScore}` : '-'}</td>
                      <td className="p-2 text-sm">{s.grade !== null ? `${s.grade}등급` : '-'}</td>
                      <td className="p-2 text-sm">
                        {s.isSubmitted ? (
                          <Badge variant="secondary">완료</Badge>
                        ) : (
                          <Badge variant="outline">미응시</Badge>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedAttempt({
                                ...s,
                                distributionId: selectedDistribution.id,
                              });
                              setShowAnswerModal(true);
                            }}
                            data-testid={`button-enter-answer-${s.studentId}`}
                          >
                            {s.isSubmitted ? '답안 수정' : '답안 입력'}
                          </Button>
                          {s.isSubmitted && !s.hasReport && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => generateReportMutation.mutate(s.attemptId)}
                              disabled={generateReportMutation.isPending}
                            >
                              <Sparkles className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );

  const renderManageContent = () => {
    switch (manageMenu) {
      case 'students': return renderStudentManagement();
      case 'classes': return renderClassManagement();
      case 'exams': return renderExamManagement();
      default: return renderStudentManagement();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderTopNav()}
      
      <div className="flex">
        {topMenu === 'misudeung' ? renderMisudeungSidebar() : renderManageSidebar()}
        {topMenu === 'misudeung' ? renderMisudeungContent() : renderManageContent()}
      </div>
      
      {showStudentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-student">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>{editingStudent ? '학생 수정' : '학생 등록'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStudentSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">이름 *</label>
                  <Input name="name" defaultValue={editingStudent?.user?.name} required data-testid="input-student-name" />
                </div>
                <div>
                  <label className="text-sm font-medium">전화번호 *</label>
                  <Input name="phone" defaultValue={editingStudent?.user?.phone} required data-testid="input-student-phone" />
                </div>
                <div>
                  <label className="text-sm font-medium">학교</label>
                  <Input name="school" defaultValue={editingStudent?.student?.school} data-testid="input-student-school" />
                </div>
                <div>
                  <label className="text-sm font-medium">학년 *</label>
                  <select name="grade" className="w-full border rounded-md p-2" defaultValue={editingStudent?.student?.grade || ''} required data-testid="select-student-grade">
                    <option value="">선택</option>
                    {['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">학부모 전화번호</label>
                  <Input name="parentPhone" defaultValue={editingStudent?.student?.parentPhone} data-testid="input-student-parent-phone" />
                </div>
                {editingStudent && (
                  <div>
                    <label className="text-sm font-medium">새 비밀번호 (변경시에만 입력)</label>
                    <Input name="password" type="password" data-testid="input-student-password" />
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowStudentModal(false); setEditingStudent(null); }}>
                    취소
                  </Button>
                  <Button type="submit" className="flex-1" disabled={createStudentMutation.isPending || updateStudentMutation.isPending} data-testid="button-submit-student">
                    {editingStudent ? '수정' : '등록'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      
      {showClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-class">
          <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingClass ? '반 수정' : '반 생성'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleClassSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">반 이름 *</label>
                  <Input name="name" defaultValue={editingClass?.name} required data-testid="input-class-name" />
                </div>
                <div>
                  <label className="text-sm font-medium">학년 *</label>
                  <select name="grade" className="w-full border rounded-md p-2" defaultValue={editingClass?.grade || ''} required data-testid="select-class-grade">
                    <option value="">선택</option>
                    {['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">설명</label>
                  <Input name="description" defaultValue={editingClass?.description} data-testid="input-class-description" />
                </div>
                <div>
                  <label className="text-sm font-medium">학생 선택</label>
                  <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                    {students?.map((s: any) => (
                      <label key={s.id} className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedClassStudents.includes(s.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClassStudents([...selectedClassStudents, s.id]);
                            } else {
                              setSelectedClassStudents(selectedClassStudents.filter(id => id !== s.id));
                            }
                          }}
                        />
                        <span className="text-sm">{s.user?.name} ({s.grade})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowClassModal(false); setEditingClass(null); }}>
                    취소
                  </Button>
                  <Button type="submit" className="flex-1" disabled={createClassMutation.isPending || updateClassMutation.isPending} data-testid="button-submit-class">
                    {editingClass ? '수정' : '생성'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      
      {showRedistributeModal && selectedDistribution && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-redistribute">
          <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>지점내 배포: {selectedDistribution.exam?.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRedistributeSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={redistributeType === 'class' ? 'default' : 'outline'}
                    onClick={() => setRedistributeType('class')}
                  >
                    반별 배포
                  </Button>
                  <Button
                    type="button"
                    variant={redistributeType === 'student' ? 'default' : 'outline'}
                    onClick={() => setRedistributeType('student')}
                  >
                    학생별 배포
                  </Button>
                </div>
                
                {redistributeType === 'class' ? (
                  <div>
                    <label className="text-sm font-medium">반 선택</label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      data-testid="select-redistribute-class"
                    >
                      <option value="">선택</option>
                      {classes?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.studentIds?.length || 0}명)</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium">학생 선택</label>
                    <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                      {students?.map((s: any) => (
                        <label key={s.id} className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds([...selectedStudentIds, s.id]);
                              } else {
                                setSelectedStudentIds(selectedStudentIds.filter(id => id !== s.id));
                              }
                            }}
                          />
                          <span className="text-sm">{s.user?.name} ({s.grade})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowRedistributeModal(false); setSelectedDistribution(null); }}>
                    취소
                  </Button>
                  <Button type="submit" className="flex-1" disabled={redistributeMutation.isPending} data-testid="button-submit-redistribute">
                    배포
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      
      {showAnswerModal && selectedAttempt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-answer">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>답안 입력: {selectedAttempt.studentName}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAnswerSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  각 문항의 답안을 입력하세요. (1~5 중 선택)
                </p>
                
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: distributionStudents?.exam?.totalQuestions || 30 }).map((_, i) => {
                    const qNum = i + 1;
                    const existingAnswer = selectedAttempt.answers?.[qNum];
                    return (
                      <div key={qNum} className="flex items-center gap-1">
                        <span className="text-sm w-8">{qNum}.</span>
                        <Input
                          name={`q${qNum}`}
                          type="number"
                          min={1}
                          max={5}
                          defaultValue={existingAnswer || ''}
                          className="w-12 text-center"
                          data-testid={`input-answer-${qNum}`}
                        />
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowAnswerModal(false); setSelectedAttempt(null); }}>
                    취소
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1" 
                    disabled={gradeAttemptMutation.isPending || createAttemptMutation.isPending}
                    data-testid="button-submit-answer"
                  >
                    저장
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
