import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Users, Building2, FileText, TrendingUp, LogOut, GraduationCap, Plus, Send, LayoutDashboard, Menu, X, ArrowUp, ArrowDown } from 'lucide-react';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
}

type MenuSection = 'dashboard' | 'branches' | 'exams' | 'distributions';

export default function AdminDashboard({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<MenuSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [viewingExam, setViewingExam] = useState<any>(null);
  const [editingExam, setEditingExam] = useState(false);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await api.get('/admin/stats');
      return res.data.data;
    },
  });

  const { data: branches, refetch: refetchBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data;
    },
  });

  const { data: exams, refetch: refetchExams } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const res = await api.get('/exams');
      return res.data.data;
    },
  });

  const { data: distributions, refetch: refetchDistributions } = useQuery({
    queryKey: ['distributions'],
    queryFn: async () => {
      const res = await api.get('/distributions');
      return res.data.data;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/branches', data);
      return res.data;
    },
    onSuccess: () => {
      refetchBranches();
      setShowBranchModal(false);
      alert('지점이 등록되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '지점 등록에 실패했습니다.');
    },
  });

  const updateBranchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/branches/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      refetchBranches();
      setShowBranchModal(false);
      setEditingBranch(null);
      alert('지점이 수정되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '지점 수정에 실패했습니다.');
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/branches/${id}`);
      return res.data;
    },
    onSuccess: () => {
      refetchBranches();
      alert('지점이 삭제되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '지점 삭제에 실패했습니다.');
    },
  });

  const impersonateBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const res = await api.post(`/auth/impersonate/${branchId}`);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      alert(data.message || '지점 관리자로 전환되었습니다.');
      // 페이지 새로고침하여 지점 관리자 대시보드로 이동
      window.location.reload();
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '전환에 실패했습니다.');
    },
  });

  const uploadExamMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/exams/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      refetchExams();
      setUploadingFile(false);
      alert(data.message || '시험이 업로드되었습니다.');
    },
    onError: (error: any) => {
      setUploadingFile(false);
      alert(error.response?.data?.message || '시험 업로드에 실패했습니다.');
    },
  });

  const deleteExamMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/exams/${id}`);
      return res.data;
    },
    onSuccess: () => {
      refetchExams();
      alert('시험이 삭제되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '시험 삭제에 실패했습니다.');
    },
  });

  const createExamMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/exams', data);
      return res.data;
    },
    onSuccess: () => {
      refetchExams();
      setShowExamModal(false);
      alert('시험이 생성되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '시험 생성에 실패했습니다.');
    },
  });

  const updateExamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/exams/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      refetchExams();
      setViewingExam(null);
      setEditingExam(false);
      alert('시험이 수정되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '시험 수정에 실패했습니다.');
    },
  });

  const createDistributionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/distributions', data);
      return res.data;
    },
    onSuccess: (data) => {
      refetchDistributions();
      setShowDistributionModal(false);
      setSelectedBranches([]);
      alert(data.message || '시험이 배포되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '시험 배포에 실패했습니다.');
    },
  });

  const deleteDistributionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/distributions/${id}`);
      return res.data;
    },
    onSuccess: () => {
      refetchDistributions();
      alert('배포가 삭제되었습니다.');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '배포 삭제에 실패했습니다.');
    },
  });

  const reorderBranchesMutation = useMutation({
    mutationFn: async (branchIds: string[]) => {
      const res = await api.post('/branches/reorder', { branchIds });
      return res.data;
    },
    onSuccess: () => {
      refetchBranches();
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || '순서 변경에 실패했습니다.');
    },
  });

  const handleBranchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      address: formData.get('address'),
      phone: formData.get('phone'),
      managerName: formData.get('managerName'),
      username: formData.get('username'),
      password: formData.get('password'),
    };

    if (editingBranch) {
      updateBranchMutation.mutate({ id: editingBranch.id, data });
    } else {
      createBranchMutation.mutate(data);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingFile(true);
      uploadExamMutation.mutate(file);
      e.target.value = ''; // Reset input
    }
  };

  const handleExamSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // Parse questions data - 간단 버전: 자동 생성
    const questionsData = [];
    const totalQuestions = parseInt(formData.get('totalQuestions') as string);

    for (let i = 1; i <= totalQuestions; i++) {
      questionsData.push({
        questionNumber: i,
        difficulty: '중',
        category: '미분류',
        subcategory: '',
        correctAnswer: (i % 5) + 1, // 1-5 순환
        points: 2,
      });
    }

    const data = {
      title: formData.get('title'),
      subject: formData.get('subject'),
      grade: formData.get('grade'),
      description: formData.get('description'),
      totalQuestions,
      totalScore: questionsData.reduce((sum, q) => sum + q.points, 0),
      questionsData,
      examTrends: [],
      overallReview: '',
    };

    createExamMutation.mutate(data);
  };

  const handleDistributionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      examId: formData.get('examId'),
      branchIds: selectedBranches,
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
    };

    createDistributionMutation.mutate(data);
  };

  const moveBranch = (index: number, direction: 'up' | 'down') => {
    if (!branches) return;

    const newBranches = [...branches];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newBranches.length) return;

    // Swap
    [newBranches[index], newBranches[targetIndex]] = [newBranches[targetIndex], newBranches[index]];

    // Update server
    const branchIds = newBranches.map((b: any) => b.id);
    reorderBranchesMutation.mutate(branchIds);
  };

  const menuItems = [
    { id: 'dashboard' as MenuSection, label: '대시보드', icon: LayoutDashboard },
    { id: 'branches' as MenuSection, label: '지점 관리', icon: Building2 },
    { id: 'exams' as MenuSection, label: '시험 생성', icon: Plus },
    { id: 'distributions' as MenuSection, label: '시험 배포', icon: Send },
  ];

  const renderDashboard = () => (
    <>
      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-orange-500 to-red-600 text-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-orange-100">총 학생 수</CardTitle>
              <Users className="w-8 h-8 text-white/80" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats?.totalStudents || 0}</div>
            <p className="text-xs text-orange-100 mt-2">전체 등록 학생</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-500 to-indigo-600 text-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-blue-100">총 지점 수</CardTitle>
              <Building2 className="w-8 h-8 text-white/80" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats?.totalBranches || 0}</div>
            <p className="text-xs text-blue-100 mt-2">운영 중인 지점</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-500 to-pink-600 text-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-purple-100">총 시험 수</CardTitle>
              <FileText className="w-8 h-8 text-white/80" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats?.totalExams || 0}</div>
            <p className="text-xs text-purple-100 mt-2">생성된 시험</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-500 to-emerald-600 text-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-100">평균 점수</CardTitle>
              <TrendingUp className="w-8 h-8 text-white/80" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats?.averageScore || 0}</div>
            <p className="text-xs text-green-100 mt-2">전체 평균</p>
          </CardContent>
        </Card>
      </div>

      {/* Branch Statistics Table */}
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-orange-50 to-red-50">
          <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-600" />
            지점별 통계
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-orange-200">
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">지점명</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-700">학생 수</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-700">시험 응시 수</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-700">평균 점수</th>
                </tr>
              </thead>
              <tbody>
                {stats?.branchStats?.map((branch: any) => (
                  <tr
                    key={branch.branchName}
                    className="border-b border-gray-100 hover:bg-orange-50 transition-colors"
                  >
                    <td className="p-3 font-medium text-gray-900">{branch.branchName}</td>
                    <td className="text-right p-3 text-gray-700">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-4 h-4 text-orange-500" />
                        {branch.studentCount}
                      </span>
                    </td>
                    <td className="text-right p-3 text-gray-700">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="w-4 h-4 text-blue-500" />
                        {branch.examCount}
                      </span>
                    </td>
                    <td className="text-right p-3">
                      <span className="inline-flex items-center justify-end gap-1 font-semibold text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        {branch.averageScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );

  const renderBranches = () => (
    <>
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              지점 관리
            </CardTitle>
            <Button
              onClick={() => {
                setEditingBranch(null);
                setShowBranchModal(true);
              }}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              지점 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-blue-200">
                  <th className="text-center p-3 text-sm font-semibold text-gray-700 w-20">순서</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">지점명</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">주소</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">전화번호</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">관리자</th>
                  <th className="text-center p-3 text-sm font-semibold text-gray-700">작업</th>
                </tr>
              </thead>
              <tbody>
                {branches?.map((branch: any, index: number) => (
                  <tr key={branch.id} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                    <td className="p-3">
                      <div className="flex gap-1 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => moveBranch(index, 'up')}
                          disabled={index === 0}
                          className="h-8 w-8 p-0 border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => moveBranch(index, 'down')}
                          disabled={index === branches.length - 1}
                          className="h-8 w-8 p-0 border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-3 font-medium text-gray-900">{branch.name}</td>
                    <td className="p-3 text-gray-700">{branch.address || '-'}</td>
                    <td className="p-3 text-gray-700">{branch.phone || '-'}</td>
                    <td className="p-3 text-gray-700">{branch.managerName || '-'}</td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm(`${branch.name} 관리자로 로그인하시겠습니까?`)) {
                              impersonateBranchMutation.mutate(branch.id);
                            }
                          }}
                          className="border-green-300 text-green-600 hover:bg-green-50"
                        >
                          로그인
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingBranch(branch);
                            setShowBranchModal(true);
                          }}
                          className="border-blue-300 text-blue-600 hover:bg-blue-50"
                        >
                          수정
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('정말 삭제하시겠습니까?')) {
                              deleteBranchMutation.mutate(branch.id);
                            }
                          }}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                {editingBranch ? '지점 수정' : '지점 추가'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleBranchSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">지점명 *</label>
                  <Input
                    name="name"
                    defaultValue={editingBranch?.name}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">주소</label>
                  <Input
                    name="address"
                    defaultValue={editingBranch?.address}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">전화번호</label>
                  <Input
                    name="phone"
                    defaultValue={editingBranch?.phone}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">관리자명 *</label>
                  <Input
                    name="managerName"
                    defaultValue={editingBranch?.managerName}
                    required
                    className="mt-1"
                  />
                </div>
                {!editingBranch && (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">관리자 아이디 *</label>
                      <Input
                        name="username"
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">관리자 비밀번호 *</label>
                      <Input
                        name="password"
                        type="password"
                        required
                        className="mt-1"
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  >
                    {editingBranch ? '수정' : '추가'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowBranchModal(false);
                      setEditingBranch(null);
                    }}
                    className="flex-1"
                  >
                    취소
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );

  const renderExams = () => (
    <>
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-600" />
              시험 생성
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowExamModal(true)}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                직접 생성
              </Button>
              <label
                htmlFor="exam-file-upload"
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white cursor-pointer transition-all ${
                  uploadingFile
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                {uploadingFile ? '업로드 중...' : 'Excel 업로드'}
              </label>
              <input
                id="exam-file-upload"
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="hidden"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {exams && exams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-purple-200">
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">시험명</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">과목</th>
                    <th className="text-center p-3 text-sm font-semibold text-gray-700">문제 수</th>
                    <th className="text-center p-3 text-sm font-semibold text-gray-700">총점</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">생성일</th>
                    <th className="text-center p-3 text-sm font-semibold text-gray-700">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam: any) => (
                    <tr key={exam.id} className="border-b border-gray-100 hover:bg-purple-50 transition-colors">
                      <td className="p-3 font-medium text-gray-900">{exam.title}</td>
                      <td className="p-3 text-gray-700">{exam.subject || '-'}</td>
                      <td className="text-center p-3 text-gray-700">{exam.totalQuestions}</td>
                      <td className="text-center p-3 text-gray-700">{exam.totalScore}점</td>
                      <td className="p-3 text-gray-700">
                        {new Date(exam.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingExam(exam)}
                            className="border-purple-300 text-purple-600 hover:bg-purple-50"
                          >
                            상세보기
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm('정말 삭제하시겠습니까?')) {
                                deleteExamMutation.mutate(exam.id);
                              }
                            }}
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">등록된 시험이 없습니다.</p>
              <p className="text-sm text-gray-400">Excel 파일을 업로드하거나 직접 생성하세요.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 시험 직접 생성 간단 모달 */}
      {showExamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <Card className="w-full max-w-md mx-4 my-8">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                새 시험 추가
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleExamSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">시험지 명 *</label>
                  <Input name="title" required className="mt-1" placeholder="시험지 명을 입력하세요" />
                </div>
                <input type="hidden" name="subject" value="국어" />
                <input type="hidden" name="totalQuestions" value="20" />
                <div>
                  <label className="text-sm font-semibold text-gray-700">학년 *</label>
                  <select
                    name="grade"
                    required
                    className="mt-1 flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">학년 선택</option>
                    <option value="초1">초1</option>
                    <option value="초2">초2</option>
                    <option value="초3">초3</option>
                    <option value="초4">초4</option>
                    <option value="초5">초5</option>
                    <option value="초6">초6</option>
                    <option value="중1">중1</option>
                    <option value="중2">중2</option>
                    <option value="중3">중3</option>
                    <option value="고1">고1</option>
                    <option value="고2">고2</option>
                    <option value="고3">고3</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700">
                    생성
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowExamModal(false)} className="flex-1">
                    취소
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 시험 상세보기/수정 모달 */}
      {viewingExam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <Card className="w-full max-w-4xl my-8">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex justify-between items-start">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  {editingExam ? '시험 수정' : '시험 상세 정보'}
                </CardTitle>
                <div className="flex gap-2">
                  {!editingExam && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingExam(true)}
                      className="border-purple-300 text-purple-600 hover:bg-purple-50"
                    >
                      수정
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => {
                    setViewingExam(null);
                    setEditingExam(false);
                  }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 max-h-[600px] overflow-y-auto">
              {editingExam ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);

                  // 문제 데이터 파싱
                  const questionsData = viewingExam.questionsData.map((q: any, idx: number) => ({
                    questionNumber: q.questionNumber,
                    difficulty: formData.get(`difficulty_${idx}`) as string,
                    category: formData.get(`category_${idx}`) as string,
                    subcategory: formData.get(`subcategory_${idx}`) as string || '',
                    correctAnswer: parseInt(formData.get(`correctAnswer_${idx}`) as string),
                    points: parseInt(formData.get(`points_${idx}`) as string),
                  }));

                  const data = {
                    title: formData.get('title'),
                    subject: formData.get('subject'),
                    grade: formData.get('grade'),
                    description: formData.get('description'),
                    totalQuestions: questionsData.length,
                    totalScore: questionsData.reduce((sum: number, q: { points: number }) => sum + q.points, 0),
                    questionsData,
                    overallReview: formData.get('overallReview'),
                  };

                  updateExamMutation.mutate({ id: viewingExam.id, data });
                }} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">시험명 *</label>
                      <Input name="title" defaultValue={viewingExam.title} required className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">과목</label>
                      <Input name="subject" defaultValue={viewingExam.subject} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">학년</label>
                      <Input name="grade" defaultValue={viewingExam.grade} className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700">총 문제 수</label>
                      <Input value={viewingExam.totalQuestions} disabled className="mt-1 bg-gray-100" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">설명</label>
                    <textarea
                      name="description"
                      defaultValue={viewingExam.description}
                      className="mt-1 w-full rounded-md border border-gray-200 p-2 text-sm"
                      rows={2}
                    />
                  </div>

                  {viewingExam.questionsData && viewingExam.questionsData.length > 0 && (
                    <div>
                      <h3 className="font-bold text-gray-800 mb-3">문제 목록</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-purple-200 bg-purple-50">
                              <th className="p-2 text-left">번호</th>
                              <th className="p-2 text-left">난이도</th>
                              <th className="p-2 text-left">출제영역</th>
                              <th className="p-2 text-left">유형분석</th>
                              <th className="p-2 text-left">소분류</th>
                              <th className="p-2 text-left">해설</th>
                              <th className="p-2 text-center">정답</th>
                              <th className="p-2 text-center">배점</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewingExam.questionsData.map((q: any, idx: number) => (
                              <tr key={q.number || q.questionNumber} className="border-b border-gray-100">
                                <td className="p-2">{q.number || q.questionNumber}</td>
                                <td className="p-2">
                                  <select
                                    name={`difficulty_${idx}`}
                                    defaultValue={q.difficulty}
                                    className="w-full border border-gray-200 rounded px-2 py-1"
                                  >
                                    <option value="상">상</option>
                                    <option value="중">중</option>
                                    <option value="하">하</option>
                                  </select>
                                </td>
                                <td className="p-2">
                                  <Input
                                    name={`domain_${idx}`}
                                    defaultValue={q.domain || q.category}
                                    className="h-8"
                                    placeholder="출제영역"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    name={`typeAnalysis_${idx}`}
                                    defaultValue={q.typeAnalysis}
                                    className="h-8"
                                    placeholder="유형분석"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    name={`subcategory_${idx}`}
                                    defaultValue={q.subcategory}
                                    className="h-8"
                                    placeholder="소분류"
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    name={`explanation_${idx}`}
                                    defaultValue={q.explanation}
                                    className="h-8"
                                    placeholder="해설"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <Input
                                    name={`correctAnswer_${idx}`}
                                    type="number"
                                    defaultValue={q.correctAnswer}
                                    className="h-8 w-16 text-center mx-auto"
                                    min="1"
                                    max="5"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <Input
                                    name={`points_${idx}`}
                                    type="number"
                                    defaultValue={q.points}
                                    className="h-8 w-16 text-center mx-auto"
                                    min="1"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-semibold text-gray-700">종합 평가</label>
                    <textarea
                      name="overallReview"
                      defaultValue={viewingExam.overallReview}
                      className="mt-1 w-full rounded-md border border-gray-200 p-2 text-sm"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700">
                      저장
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditingExam(false)} className="flex-1">
                      취소
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">시험명</p>
                      <p className="font-semibold text-lg">{viewingExam.title}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">과목</p>
                      <p className="font-semibold">{viewingExam.subject || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">총 문제 수</p>
                      <p className="font-semibold">{viewingExam.totalQuestions}문제</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">총점</p>
                      <p className="font-semibold">{viewingExam.totalScore}점</p>
                    </div>
                  </div>

                  {viewingExam.questionsData && viewingExam.questionsData.length > 0 && (
                    <div>
                      <h3 className="font-bold text-gray-800 mb-3">문제 목록</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-purple-200 bg-purple-50">
                              <th className="p-2 text-left">번호</th>
                              <th className="p-2 text-left">난이도</th>
                              <th className="p-2 text-left">출제영역</th>
                              <th className="p-2 text-left">유형분석</th>
                              <th className="p-2 text-left">소분류</th>
                              <th className="p-2 text-left">해설</th>
                              <th className="p-2 text-center">정답</th>
                              <th className="p-2 text-center">배점</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewingExam.questionsData.map((q: any) => (
                              <tr key={q.number || q.questionNumber} className="border-b border-gray-100 hover:bg-purple-50">
                                <td className="p-2">{q.number || q.questionNumber}</td>
                                <td className="p-2">{q.difficulty || '-'}</td>
                                <td className="p-2">{q.domain || q.category || '-'}</td>
                                <td className="p-2">{q.typeAnalysis || '-'}</td>
                                <td className="p-2">{q.subcategory || '-'}</td>
                                <td className="p-2 max-w-xs truncate" title={q.explanation}>{q.explanation || '-'}</td>
                                <td className="p-2 text-center font-semibold text-green-600">{q.correctAnswer}</td>
                                <td className="p-2 text-center">{q.points || q.score}점</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {viewingExam.examTrends && viewingExam.examTrends.length > 0 && (
                    <div>
                      <h3 className="font-bold text-gray-800 mb-3">출제 경향</h3>
                      <div className="space-y-2">
                        {viewingExam.examTrends.map((trend: any, idx: number) => (
                          <div key={idx} className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg">
                            <p className="text-sm">
                              <span className="font-semibold text-indigo-700">문항 {trend.questionNumbers}:</span>
                              <span className="text-gray-700 ml-2">{trend.description}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewingExam.overallReview && (
                    <div>
                      <h3 className="font-bold text-gray-800 mb-2">종합 평가</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{viewingExam.overallReview}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );

  const renderDistributions = () => (
    <>
      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-orange-50 to-red-50">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-600" />
              시험 배포
            </CardTitle>
            <Button
              onClick={() => setShowDistributionModal(true)}
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              시험 배포
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {distributions && distributions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-orange-200">
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">시험명</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">지점</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">시작일</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">종료일</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-700">배포일</th>
                    <th className="text-center p-3 text-sm font-semibold text-gray-700">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {distributions.map((dist: any) => (
                    <tr key={dist.id} className="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                      <td className="p-3 font-medium text-gray-900">{dist.exam?.title || '-'}</td>
                      <td className="p-3 text-gray-700">{dist.branchId}</td>
                      <td className="p-3 text-gray-700">
                        {new Date(dist.startDate).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="p-3 text-gray-700">
                        {new Date(dist.endDate).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="p-3 text-gray-700">
                        {new Date(dist.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm('정말 삭제하시겠습니까?')) {
                                deleteDistributionMutation.mutate(dist.id);
                              }
                            }}
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Send className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">배포된 시험이 없습니다.</p>
              <p className="text-sm text-gray-400">시험을 지점에 배포하세요.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 배포 모달 */}
      {showDistributionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50">
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-orange-600" />
                시험 배포
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleDistributionSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">시험 선택 *</label>
                  <select
                    name="examId"
                    required
                    className="mt-1 w-full rounded-md border border-gray-200 p-2 text-sm"
                  >
                    <option value="">시험을 선택하세요</option>
                    {exams?.map((exam: any) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.title} ({exam.subject}, {exam.totalQuestions}문제)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    배포 지점 선택 * ({selectedBranches.length}개 선택됨)
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3 space-y-2">
                    {branches?.map((branch: any) => (
                      <label key={branch.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedBranches.includes(branch.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBranches([...selectedBranches, branch.id]);
                            } else {
                              setSelectedBranches(selectedBranches.filter((id) => id !== branch.id));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{branch.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">시작일 *</label>
                    <Input
                      name="startDate"
                      type="date"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">종료일 *</label>
                    <Input
                      name="endDate"
                      type="date"
                      required
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={selectedBranches.length === 0}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                  >
                    배포 ({selectedBranches.length}개 지점)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowDistributionModal(false);
                      setSelectedBranches([]);
                    }}
                    className="flex-1"
                  >
                    취소
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white/80 backdrop-blur-md shadow-xl border-r border-orange-100 transition-all duration-300 flex flex-col`}
      >
        {/* Logo Section */}
        <div className="p-4 border-b border-orange-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <h2 className="font-bold text-lg bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent whitespace-nowrap">
                  ALLGA 시스템
                </h2>
                <p className="text-xs text-gray-500 truncate">{user.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-orange-50'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                {sidebarOpen && (
                  <span className="font-medium whitespace-nowrap">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-orange-100">
          <button
            onClick={() => logoutMutation.mutate()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5 flex-shrink-0 text-red-500" />
            {sidebarOpen && <span className="font-medium">로그아웃</span>}
          </button>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform"
        >
          {sidebarOpen ? <X className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md shadow-md border-b border-orange-100 sticky top-0 z-10">
          <div className="px-8 py-5">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                {menuItems.find((item) => item.id === activeSection)?.label}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {user.name}님 환영합니다
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-8">
          {activeSection === 'dashboard' && renderDashboard()}
          {activeSection === 'branches' && renderBranches()}
          {activeSection === 'exams' && renderExams()}
          {activeSection === 'distributions' && renderDistributions()}
        </main>
      </div>
    </div>
  );
}
