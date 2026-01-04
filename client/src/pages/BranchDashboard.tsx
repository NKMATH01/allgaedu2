import { useState, useMemo, useRef } from 'react';
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
  Plus, Trash2, Edit, Sparkles, Search, User, BookOpen, ClipboardList,
  Save, RotateCcw, Check, X, AlertTriangle, BarChart3, Download, Loader2, Ban
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
  const [editingScore, setEditingScore] = useState<string | null>(null);
  
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
  const [expandedDistributeGrades, setExpandedDistributeGrades] = useState<Record<string, boolean>>({});
  const [answerStates, setAnswerStates] = useState<Record<number, 'correct' | 'wrong' | null>>({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [generatingAttemptId, setGeneratingAttemptId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    mutationFn: async ({ attemptId, gradingData }: { attemptId: string; gradingData: any }) => {
      const res = await api.put(`/exam-attempts/${attemptId}/branch-grade`, { gradingData });
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['distribution-students'] });
      await queryClient.invalidateQueries({ queryKey: ['all-distribution-students'] });
      refetchDistributionStudents(); refetchAllDistributionStudents();
      setShowAnswerModal(false); setSelectedAttempt(null); setAnswerStates({});
      alert('채점 결과가 저장되었습니다.');
    },
    onError: (error: any) => { alert(error.response?.data?.message || '채점 저장에 실패했습니다.'); },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (attemptId: string) => {
      abortControllerRef.current = new AbortController();
      setGeneratingAttemptId(attemptId);
      const res = await api.post(`/reports/generate/${attemptId}`, {}, {
        signal: abortControllerRef.current.signal
      });
      return res.data;
    },
    onSuccess: (data) => {
      setGeneratingAttemptId(null);
      abortControllerRef.current = null;
      refetchDistributionStudents();
      refetchAllDistributionStudents();
      alert(data.message || 'AI 분석이 완료되었습니다.');
    },
    onError: (error: any) => {
      setGeneratingAttemptId(null);
      abortControllerRef.current = null;
      if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        return;
      }
      alert(error.response?.data?.message || 'AI 분석에 실패했습니다.');
    },
  });

  const cancelReportGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setGeneratingAttemptId(null);
    }
  };

  const deleteReportMutation = useMutation({
    mutationFn: async (attemptId: string) => {
      const res = await api.delete(`/reports/${attemptId}`);
      return res.data;
    },
    onSuccess: () => {
      refetchDistributionStudents();
      refetchAllDistributionStudents();
      alert('보고서가 삭제되었습니다. 재분석할 수 있습니다.');
    },
    onError: (error: any) => { alert(error.response?.data?.message || '보고서 삭제에 실패했습니다.'); },
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

  const handleAnswerSubmit = () => {
    let totalQuestions = 30;
    if (selectedAttempt?.exam?.totalQuestions) {
      totalQuestions = selectedAttempt.exam.totalQuestions;
    } else if (distributionStudents?.exam?.totalQuestions) {
      totalQuestions = distributionStudents.exam.totalQuestions;
    } else if (selectedAttempt?.distributionId && allDistributionStudents) {
      const distData = allDistributionStudents.find((d: any) => d.distribution.id === selectedAttempt.distributionId);
      if (distData?.exam?.totalQuestions) totalQuestions = distData.exam.totalQuestions;
    }
    
    const correctAnswers = Object.entries(answerStates)
      .filter(([_, v]) => v === 'correct')
      .map(([k, _]) => parseInt(k));
    const wrongAnswers = Object.entries(answerStates)
      .filter(([_, v]) => v === 'wrong')
      .map(([k, _]) => parseInt(k));
    
    if (correctAnswers.length === 0 && wrongAnswers.length === 0) { 
      alert('최소 1개 이상의 답안을 입력해주세요.'); 
      return; 
    }
    
    const gradingData = {
      correctQuestions: correctAnswers,
      wrongQuestions: wrongAnswers,
      totalQuestions,
    };
    
    if (selectedAttempt.attemptId) {
      gradeAttemptMutation.mutate({ attemptId: selectedAttempt.attemptId, gradingData });
    } else {
      if (!selectedAttempt.studentId || !selectedAttempt.distributionId) { 
        alert('학생 정보가 올바르지 않습니다.'); 
        return; 
      }
      createAttemptMutation.mutate({ studentId: selectedAttempt.studentId, distributionId: selectedAttempt.distributionId }, {
        onSuccess: (data) => {
          const newAttemptId = data.data?.id || data.id;
          if (newAttemptId) gradeAttemptMutation.mutate({ attemptId: newAttemptId, gradingData });
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

  const formatExamDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}.${mm}.${dd}`;
  };

  const renderMisudeungContent = () => {
    const studentExamData = selectedStudent ? getStudentExamData(selectedStudent.id) : [];

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
                  <p className="text-sm text-muted-foreground">{selectedStudent.grade} | {selectedStudent.school}</p>
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                시험 ({studentExamData.length}개)
              </h3>
            </div>
            
            {studentExamData.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-3 border-b grid grid-cols-12 gap-4 text-sm font-medium text-muted-foreground">
                  <div className="col-span-1 text-center">학년</div>
                  <div className="col-span-5">시험명</div>
                  <div className="col-span-2 text-center">날짜</div>
                  <div className="col-span-2 text-center">채점</div>
                  <div className="col-span-2 text-center">보고서</div>
                </div>
                
                <div className="divide-y">
                  {studentExamData.map((examData: any) => {
                    const isGraded = examData.isSubmitted || examData.submittedAt;
                    const hasReport = examData.hasReport;
                    const examId = examData.distribution?.id || examData.attemptId;
                    const examDate = examData.distribution?.createdAt || examData.exam?.createdAt;
                    
                    return (
                      <div 
                        key={examId} 
                        className="px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-muted/30 transition-colors"
                        data-testid={`row-exam-${examId}`}
                      >
                        <div className="col-span-1 text-center">
                          <Badge variant="outline" className="text-xs">
                            {selectedStudent.grade?.replace(/[^가-힣0-9]/g, '').slice(0, 2) || '-'}
                          </Badge>
                        </div>
                        
                        <div className="col-span-5">
                          <div className="font-medium text-sm truncate">{examData.exam?.title || '시험'}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>{examData.exam?.totalQuestions}문제</span>
                            {examData.exam?.subject && (
                              <>
                                <span className="text-muted-foreground/50">|</span>
                                <span>{examData.exam.subject}</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="col-span-2 text-center text-sm text-muted-foreground">
                          {formatExamDate(examDate)}
                        </div>
                        
                        <div className="col-span-2 text-center">
                          {isGraded ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-semibold text-primary"
                              onClick={() => {
                                setSelectedAttempt({
                                  ...examData,
                                  studentId: selectedStudent.id,
                                  distributionId: examData.distribution?.id,
                                });
                                setSelectedDistribution(examData.distribution);
                                setShowAnswerModal(true);
                              }}
                              data-testid={`button-score-${examId}`}
                            >
                              {examData.score}점
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedAttempt({
                                  ...examData,
                                  studentId: selectedStudent.id,
                                  distributionId: examData.distribution?.id,
                                });
                                setSelectedDistribution(examData.distribution);
                                setShowAnswerModal(true);
                              }}
                              data-testid={`button-grade-${examId}`}
                            >
                              채점전
                            </Button>
                          )}
                        </div>
                        
                        <div className="col-span-2 text-center">
                          {!isGraded ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : generatingAttemptId === examData.attemptId ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={cancelReportGeneration}
                              data-testid={`button-cancel-report-${examId}`}
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              취소
                            </Button>
                          ) : hasReport ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedReport({
                                    ...examData,
                                    studentName: selectedStudent.user?.name,
                                  });
                                  setShowReportModal(true);
                                }}
                                data-testid={`button-view-report-${examId}`}
                              >
                                보고서 보기
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm('보고서를 삭제하고 재분석하시겠습니까?')) {
                                    deleteReportMutation.mutate(examData.attemptId);
                                  }
                                }}
                                disabled={deleteReportMutation.isPending}
                                title="보고서 삭제"
                                data-testid={`button-delete-report-${examId}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => generateReportMutation.mutate(examData.attemptId)}
                              disabled={generateReportMutation.isPending}
                              data-testid={`button-create-report-${examId}`}
                            >
                              <Sparkles className="w-4 h-4 mr-1" />
                              보고서 만들기
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  배포된 시험이 없습니다.
                </CardContent>
              </Card>
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
                            generatingAttemptId === s.attemptId ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={cancelReportGeneration}
                              >
                                <Ban className="w-4 h-4 mr-1" />
                                취소
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => generateReportMutation.mutate(s.attemptId)}
                                disabled={generateReportMutation.isPending}
                              >
                                <Sparkles className="w-4 h-4" />
                              </Button>
                            )
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
                    <div className="border rounded-md p-2 max-h-64 overflow-y-auto space-y-1">
                      {(() => {
                        const gradeOrder = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
                        const grouped: Record<string, any[]> = {};
                        students?.forEach((s: any) => {
                          const grade = s.grade || '미지정';
                          if (!grouped[grade]) grouped[grade] = [];
                          grouped[grade].push(s);
                        });
                        const sortedGrades = gradeOrder.filter(g => grouped[g]);
                        if (grouped['미지정']) sortedGrades.push('미지정');
                        
                        return sortedGrades.map(grade => {
                          const gradeStudents = grouped[grade] || [];
                          const allSelected = gradeStudents.every((s: any) => selectedStudentIds.includes(s.id));
                          const someSelected = gradeStudents.some((s: any) => selectedStudentIds.includes(s.id));
                          const isExpanded = expandedDistributeGrades[grade];
                          
                          return (
                            <div key={grade} className="border-b last:border-b-0 pb-1">
                              <div
                                className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer"
                                role="button"
                                tabIndex={0}
                                onClick={() => setExpandedDistributeGrades(prev => ({ ...prev, [grade]: !prev[grade] }))}
                                onKeyDown={(e) => e.key === 'Enter' && setExpandedDistributeGrades(prev => ({ ...prev, [grade]: !prev[grade] }))}
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const gradeIds = gradeStudents.map((s: any) => s.id);
                                    if (e.target.checked) {
                                      setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...gradeIds])));
                                    } else {
                                      setSelectedStudentIds(selectedStudentIds.filter(id => !gradeIds.includes(id)));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-sm font-medium">{grade}</span>
                                <Badge variant="secondary" className="text-xs ml-auto">{gradeStudents.length}명</Badge>
                              </div>
                              
                              {isExpanded && (
                                <div className="ml-6 space-y-0.5">
                                  {gradeStudents.map((s: any) => (
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
                                      <span className="text-sm">{s.user?.name}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      선택됨: {selectedStudentIds.length}명
                    </p>
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
          <Card className="w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-4 border-b flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">강사 전용 채점 시스템</h2>
                  <p className="text-sm text-muted-foreground">{selectedAttempt.exam?.title || '시험'}</p>
                </div>
              </div>
              <Button 
                onClick={handleAnswerSubmit}
                disabled={gradeAttemptMutation.isPending || createAttemptMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="button-submit-answer"
              >
                <Save className="w-4 h-4 mr-2" />
                채점 결과 저장
              </Button>
            </div>
            
            <div className="p-4 border-b bg-muted/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                    onClick={() => {
                      const totalQ = selectedAttempt.exam?.totalQuestions || distributionStudents?.exam?.totalQuestions || 30;
                      const newAnswers: Record<number, 'correct' | 'wrong' | null> = {};
                      for (let i = 1; i <= totalQ; i++) newAnswers[i] = 'correct';
                      setAnswerStates(newAnswers);
                    }}
                    data-testid="button-mark-all-correct"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    전체 정답 처리
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => {
                      const totalQ = selectedAttempt.exam?.totalQuestions || distributionStudents?.exam?.totalQuestions || 30;
                      const newAnswers: Record<number, 'correct' | 'wrong' | null> = {};
                      for (let i = 1; i <= totalQ; i++) newAnswers[i] = 'wrong';
                      setAnswerStates(newAnswers);
                    }}
                    data-testid="button-mark-all-wrong"
                  >
                    <X className="w-4 h-4 mr-1" />
                    전체 오답 처리
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAnswerStates({})}
                    data-testid="button-reset-answers"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    선택 초기화
                  </Button>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">정답</div>
                    <div className="font-bold text-green-600">{Object.values(answerStates).filter(v => v === 'correct').length}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">오답</div>
                    <div className="font-bold text-red-600">{Object.values(answerStates).filter(v => v === 'wrong').length}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">미입력</div>
                    <div className="font-bold text-muted-foreground">
                      {(selectedAttempt.exam?.totalQuestions || distributionStudents?.exam?.totalQuestions || 30) - Object.values(answerStates).filter(v => v !== null).length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {Array.from({ length: selectedAttempt.exam?.totalQuestions || distributionStudents?.exam?.totalQuestions || 30 }).map((_, i) => {
                  const qNum = i + 1;
                  const state = answerStates[qNum];
                  return (
                    <div
                      key={qNum}
                      className={`flex items-center gap-4 p-3 rounded-xl border-2 transition-colors ${
                        state === 'correct' 
                          ? 'border-green-400 bg-green-50/50 dark:bg-green-950/30' 
                          : state === 'wrong' 
                          ? 'border-red-400 bg-red-50/50 dark:bg-red-950/30' 
                          : 'border-muted bg-background'
                      }`}
                      data-testid={`answer-row-${qNum}`}
                    >
                      <span className="text-lg font-medium w-8 text-center">{qNum}</span>
                      <div className="flex-1" />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAnswerStates(prev => ({ ...prev, [qNum]: prev[qNum] === 'correct' ? null : 'correct' }))}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            state === 'correct'
                              ? 'bg-green-500 text-white'
                              : 'bg-muted/50 text-muted-foreground hover:bg-green-100 dark:hover:bg-green-900'
                          }`}
                          data-testid={`button-correct-${qNum}`}
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnswerStates(prev => ({ ...prev, [qNum]: prev[qNum] === 'wrong' ? null : 'wrong' }))}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            state === 'wrong'
                              ? 'bg-red-500 text-white'
                              : 'bg-muted/50 text-muted-foreground hover:bg-red-100 dark:hover:bg-red-900'
                          }`}
                          data-testid={`button-wrong-${qNum}`}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-4 border-t flex justify-end">
              <Button type="button" variant="outline" onClick={() => { setShowAnswerModal(false); setSelectedAttempt(null); setAnswerStates({}); }}>
                닫기
              </Button>
            </div>
          </Card>
        </div>
      )}
      
      {showReportModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-report">
          <Card className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-4 border-b">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">AI 분석 보고서 (v2)</h2>
                    <p className="text-sm text-muted-foreground">{selectedReport.studentName} - {selectedReport.exam?.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedReport.score}/{selectedReport.maxScore}점</Badge>
                  <Badge>{selectedReport.grade}등급</Badge>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {selectedReport.report ? (() => {
                const report = selectedReport.report;
                const analysisData = report.analysis || {};
                const isV2 = report.metaVersion === 'v2';
                const summary = analysisData.olgaSummary || report.summary || analysisData.summary;
                const subjectDetails = analysisData.subjectDetails || [];
                const strengths = analysisData.strengths || [];
                const weaknesses = analysisData.weaknesses || [];
                const propensity = analysisData.propensity;
                const scoreSummary = report.scoreSummary;
                
                return (
                  <div className="space-y-6">
                    {scoreSummary && (
                      <div className="grid grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">등급</p>
                          <p className="text-2xl font-bold text-primary">{scoreSummary.grade}등급</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">원점수</p>
                          <p className="text-xl font-semibold">{scoreSummary.rawScore}/{scoreSummary.rawScoreMax}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">표준점수</p>
                          <p className="text-xl font-semibold">{scoreSummary.standardScore}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">백분위</p>
                          <p className="text-xl font-semibold">{scoreSummary.percentile}%</p>
                        </div>
                      </div>
                    )}
                    
                    {summary && (
                      <div>
                        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                          <BookOpen className="w-5 h-5" />
                          올가 분석 총평
                        </h3>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-muted-foreground whitespace-pre-wrap">{summary}</p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    
                    {subjectDetails.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5" />
                          영역별 상세 분석
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                          {subjectDetails.map((subject: any, i: number) => (
                            <Card key={i} className={`border-l-4 ${
                              subject.statusColor === 'blue' ? 'border-l-blue-500' :
                              subject.statusColor === 'green' ? 'border-l-green-500' :
                              subject.statusColor === 'orange' ? 'border-l-orange-500' : 'border-l-red-500'
                            }`}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-semibold">{subject.name}</span>
                                  <Badge variant={subject.score >= 70 ? "default" : "secondary"}>{subject.score}%</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">{subject.scoreText}</p>
                                <p className="text-sm">{subject.analysisText}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {strengths.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-lg mb-2 text-green-600 flex items-center gap-2">
                          <Check className="w-5 h-5" />
                          강점 영역
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          {strengths.map((s: any, i: number) => (
                            <Card key={i} className="border-green-200 dark:border-green-800">
                              <CardContent className="p-3">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-medium text-green-700 dark:text-green-300">{s.name}</span>
                                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{s.score}%</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{s.analysisText}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {weaknesses.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-lg mb-2 text-red-600 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          취약 영역
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          {weaknesses.map((w: any, i: number) => (
                            <Card key={i} className="border-red-200 dark:border-red-800">
                              <CardContent className="p-3">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-medium text-red-700 dark:text-red-300">{w.name}</span>
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{w.score}%</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{w.analysisText}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {propensity && propensity.typeTitle && (
                      <div>
                        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                          <User className="w-5 h-5" />
                          학습 성향 분석
                        </h3>
                        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950">
                          <CardContent className="p-4">
                            <p className="font-bold text-lg text-indigo-700 dark:text-indigo-300 mb-2">{propensity.typeTitle}</p>
                            <p className="text-muted-foreground">{propensity.typeDescription}</p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="text-center py-12 text-muted-foreground">
                  보고서 데이터를 불러올 수 없습니다.
                </div>
              )}
            </div>
            
            <div className="p-4 border-t flex justify-end gap-3">
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  if (selectedReport?.attemptId) {
                    window.open(`/api/reports/${selectedReport.attemptId}/html`, '_blank');
                  }
                }}
                data-testid="button-view-pdf"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF 보기
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowReportModal(false); setSelectedReport(null); }}>
                닫기
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
