import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Key,
  List,
  RefreshCcw,
  ShieldCheck,
  Plus,
  Search,
  Trash2,
  Unlink,
  ChevronRight,
  ChevronLeft,
  Copy,
  CheckCircle2,
  AlertCircle,
  Eye,
  Download,
  Upload,
  X,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import PromptManagement from './components/PromptManagement';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const StatsCard = ({ title, value, trend }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md animate-in fade-in duration-500">
    <p className="text-sm text-slate-500 font-medium">{title}</p>
    <div className="flex items-end justify-between mt-2">
      <span className="text-3xl font-bold text-slate-900 tracking-tight">{value}</span>
      {trend && (
        <span className={cn("text-[10px] font-bold px-2 py-1 rounded-lg uppercase", trend.color)}>
          {trend.text}
        </span>
      )}
    </div>
  </div>
);

const Badge = ({ status }: { status: string }) => {
  const styles: any = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-100",
    used: "bg-blue-50 text-blue-700 border-blue-100",
    revoked: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return (
    <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wider", styles[status] || "bg-slate-50 text-slate-700")}>
      {status === 'active' ? '未使用' : status === 'used' ? '已绑定' : '已撤销'}
    </span>
  );
};

// --- App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [generateBatch, setGenerateBatch] = useState('');
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importBatch, setImportBatch] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [detailLicense, setDetailLicense] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.code === 0) setStats(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchRecent = async () => {
    try {
      const res = await fetch('/api/admin/recent');
      const data = await res.json();
      if (data.code === 0) setRecentActivities(data.data.list);
    } catch (e) { console.error(e); }
  };

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/licenses?page=${page}`;
      if (search) url += `&search=${search}`;
      if (statusFilter && statusFilter !== 'all') url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 0) {
        setLicenses(data.data.list);
        setTotal(data.data.total);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/licenses/${id}`);
      const data = await res.json();
      if (data.code === 0) setDetailLicense(data.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchStats();
    fetchRecent();
    fetchLicenses();
  }, [page, statusFilter]);

  const handleGenerate = async () => {
    try {
      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: generateCount, batch: generateBatch })
      });
      const data = await res.json();
      if (data.code === 0) {
        setGeneratedKeys(data.data.keys);
        fetchLicenses();
        fetchStats();
        alert(`成功生成 ${data.data.count} 个卡密`);
      } else {
        alert(`生成失败: ${data.message}`);
      }
    } catch (e) { alert('生成失败'); }
  };

  const handleImport = async () => {
    const keys = importText.split('\n').map(k => k.trim()).filter(k => k.length > 0);
    if (keys.length === 0) { alert('请输入至少一个卡密'); return; }
    try {
      const res = await fetch('/api/admin/import-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys, batch: importBatch })
      });
      const data = await res.json();
      if (data.code === 0) {
        alert(`导入完成：成功 ${data.data.imported} 个，跳过 ${data.data.skipped} 个`);
        setImportText('');
        setShowImport(false);
        fetchLicenses();
        fetchStats();
      } else {
        alert(`导入失败: ${data.message}`);
      }
    } catch (e) { alert('导入失败'); }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm('确定撤销吗？撤销后该卡密永久失效。')) return;
    await fetch(`/api/admin/licenses/${id}/revoke`, { method: 'POST' });
    fetchLicenses();
    fetchStats();
  };

  const handleUnbind = async (id: number) => {
    if (!confirm('确定解绑吗？解绑后卡密恢复为未使用状态，可重新绑定新机器。')) return;
    await fetch(`/api/admin/licenses/${id}/unbind`, { method: 'POST' });
    fetchLicenses();
    fetchStats();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const copyAllKeys = () => {
    navigator.clipboard.writeText(generatedKeys.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const exportCSV = () => {
    const csv = ['卡密,状态,批次,创建时间'];
    generatedKeys.forEach(key => {
      csv.push(`${key},active,${generateBatch},${new Date().toISOString()}`);
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `licenses-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusTabs = [
    { value: 'all', label: '全部' },
    { value: 'active', label: '未使用' },
    { value: 'used', label: '已绑定' },
    { value: 'revoked', label: '已撤销' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
        <div className="p-8 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">授权卫士</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200",
              activeTab === 'dashboard' ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-50 font-normal"
            )}
          >
            <LayoutDashboard className="w-5 h-5 mr-3" />
            仪表盘
          </button>

          <button
            onClick={() => setActiveTab('generate')}
            className={cn(
              "w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 text-left",
              activeTab === 'generate' ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-50 font-normal"
            )}
          >
            <Plus className="w-5 h-5 mr-3" />
            生成中心
          </button>

          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              "w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 text-left",
              activeTab === 'list' ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-50 font-normal"
            )}
          >
            <List className="w-5 h-5 mr-3" />
            授权列表
          </button>

          <button
            onClick={() => setActiveTab('prompts')}
            className={cn(
              "w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 text-left",
              activeTab === 'prompts' ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-50 font-normal"
            )}
          >
            <MessageSquare className="w-5 h-5 mr-3" />
            提示词管理
          </button>
        </nav>

        <div className="p-6 mt-auto">
          <div className="bg-slate-900 rounded-2xl p-4 shadow-xl">
            <p className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-widest text-center">系统存储状态</p>
            <p className="text-white font-bold text-sm text-center">SQLite 稳定运行中</p>
            <div className="w-full bg-slate-700 h-1 rounded-full mt-3 overflow-hidden">
              <div className="bg-blue-500 w-[100%] h-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {activeTab === 'dashboard' && '仪表盘概览'}
              {activeTab === 'generate' && '创建授权码'}
              {activeTab === 'list' && '授权档案库'}
              {activeTab === 'prompts' && '提示词管理'}
            </h1>
            <p className="text-slate-400 text-sm">
              {activeTab === 'dashboard' && '实时监测授权分发与激活状态'}
              {activeTab === 'generate' && '配置并生成新的永久性授权密钥'}
              {activeTab === 'list' && '管理已签发的授权，进行吊销或解绑操作'}
              {activeTab === 'prompts' && '查阅和管理用户提交的提示词与总结报告'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => { fetchStats(); fetchRecent(); fetchLicenses(); }}
              className="px-4 py-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all border border-slate-200 bg-white shadow-sm flex items-center gap-2 text-sm font-medium"
            >
              <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
              刷新
            </button>
            <div className="w-10 h-10 bg-slate-200 rounded-full border-2 border-white shadow-md overflow-hidden flex items-center justify-center text-xs font-bold text-slate-500">
              AD
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">

          {activeTab === 'dashboard' && stats && (
            <div className="space-y-8 animate-in fade-in duration-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard title="总授权数" value={stats.total} trend={{ text: '+100%', color: 'bg-blue-50 text-blue-600' }} />
                <StatsCard title="待激活" value={stats.active} trend={{ text: 'Ready', color: 'bg-emerald-50 text-emerald-600' }} />
                <StatsCard title="已激活" value={stats.used} trend={{ text: 'Active', color: 'bg-indigo-50 text-indigo-600' }} />
                <StatsCard title="今日消费" value={stats.today_consumed} trend={{ text: 'Today', color: 'bg-amber-50 text-amber-600' }} />
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <h3 className="text-lg font-bold mb-6 text-slate-800 tracking-tight">核心服务状态</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="flex items-center gap-5 p-6 rounded-2xl bg-emerald-50 border border-emerald-100 transition-all hover:shadow-inner">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                    <div>
                      <p className="font-bold text-emerald-900 text-lg">认证网关 (V1)</p>
                      <p className="text-sm text-emerald-700">Node.js 实例在线</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 p-6 rounded-2xl bg-blue-50 border border-blue-100 transition-all hover:shadow-inner">
                    <AlertCircle className="w-10 h-10 text-blue-600" />
                    <div>
                      <p className="font-bold text-blue-900 text-lg">HMAC 签名引擎</p>
                      <p className="text-sm text-blue-700">SHA-256 算法就绪</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">最近激活记录</h3>
                  <p className="text-xs text-slate-400 mt-1">最近 20 条设备激活记录</p>
                </div>
                {recentActivities.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">暂无激活记录</div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                        <th className="px-8 py-3">卡密</th>
                        <th className="px-8 py-3">硬件指纹</th>
                        <th className="px-8 py-3">激活时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentActivities.map((act: any) => (
                        <tr key={act.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-8 py-4">
                            <code className="text-sm font-mono text-blue-600 font-bold tracking-tight">{act.key}</code>
                          </td>
                          <td className="px-8 py-4">
                            <code className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono truncate max-w-[200px] inline-block border border-slate-200">
                              {act.machine_fingerprint}
                            </code>
                          </td>
                          <td className="px-8 py-4">
                            <p className="text-sm font-medium text-slate-600">{format(new Date(act.consumed_at), 'yyyy/MM/dd HH:mm')}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-8 duration-500">
              {/* Generate Form */}
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-200 p-10 space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3">授权分发数量</label>
                    <input
                      type="number"
                      value={generateCount}
                      onChange={(e) => setGenerateCount(parseInt(e.target.value))}
                      className="w-full px-6 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-lg font-medium"
                      placeholder="例如: 10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3">批次/渠道标记 (可选)</label>
                    <input
                      type="text"
                      value={generateBatch}
                      onChange={(e) => setGenerateBatch(e.target.value)}
                      className="w-full px-6 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-lg font-medium"
                      placeholder="例如: 2024-CLIENT-A"
                    />
                  </div>
                </div>
                <button
                  onClick={handleGenerate}
                  className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl shadow-blue-200 text-lg"
                >
                  <Plus className="w-6 h-6" />
                  立即批量签发授权码
                </button>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    生成的授权码遵循 16 位 Base32 编码标准。系统将自动应用防碰撞逻辑并确保数据库唯一性。
                  </p>
                </div>
              </div>

              {/* Import Section */}
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-200 p-10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="font-bold text-slate-700">外部导入卡密</span>
                  </div>
                  <button
                    onClick={() => setShowImport(!showImport)}
                    className={cn(
                      "text-sm font-bold px-4 py-2 rounded-xl border transition-all",
                      showImport
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "text-slate-500 border-slate-200 hover:text-blue-600 hover:border-blue-300"
                    )}
                  >
                    {showImport ? '收起' : '展开'}
                  </button>
                </div>
                {showImport && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-3">卡密列表（每行一个）</label>
                      <textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        rows={6}
                        className="w-full px-6 py-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all font-mono text-sm resize-y"
                        placeholder={"XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY"}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-3">批次标记 (可选)</label>
                      <input
                        type="text"
                        value={importBatch}
                        onChange={(e) => setImportBatch(e.target.value)}
                        className="w-full px-6 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm font-medium"
                        placeholder="例如: imported-2026"
                      />
                    </div>
                    <button
                      onClick={handleImport}
                      className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl text-base"
                    >
                      <Upload className="w-5 h-5" />
                      导入卡密
                    </button>
                  </div>
                )}
              </div>

              {/* Generated Keys Result */}
              {generatedKeys.length > 0 && (
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-200 p-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">生成结果</h3>
                      <p className="text-sm text-slate-400 mt-1">本次生成 {generatedKeys.length} 个卡密</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyAllKeys}
                        className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center gap-2"
                      >
                        {copiedAll ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        {copiedAll ? '已复制' : '复制全部'}
                      </button>
                      <button
                        onClick={exportCSV}
                        className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        导出 CSV
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">卡密</th>
                          <th className="px-4 py-3 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {generatedKeys.map((key, idx) => (
                          <tr key={key} className="hover:bg-slate-50/40 transition-colors group">
                            <td className="px-4 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <code className="text-sm font-mono text-blue-600 font-bold tracking-tight">{key}</code>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => copyToClipboard(key)}
                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-600 transition-all p-1 hover:bg-slate-100 rounded-lg inline-flex"
                              >
                                {copiedKey === key ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'list' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4 flex-1">
                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    {statusTabs.map(tab => (
                      <button
                        key={tab.value}
                        onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          statusFilter === tab.value
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="输入授权码进行检索..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setPage(1);
                          fetchLicenses();
                        }
                      }}
                      className="w-full pl-11 pr-5 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-medium text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-bold tracking-widest uppercase italic">Total: {total} Keys</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                      <th className="px-8 py-4">授权序列码</th>
                      <th className="px-8 py-4 text-center">生命周期状态</th>
                      <th className="px-8 py-4">已绑定硬件指纹</th>
                      <th className="px-8 py-4">签发时间</th>
                      <th className="px-8 py-4 text-right">紧急操作区域</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {licenses.map((lic) => (
                      <tr key={lic.id} className="hover:bg-slate-50/40 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <code className="text-sm font-mono text-blue-600 font-bold tracking-tight">
                              {lic.key}
                            </code>
                            <button
                              onClick={() => copyToClipboard(lic.key)}
                              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-blue-600 transition-all p-1 hover:bg-slate-100 rounded-lg"
                            >
                              {copiedKey === lic.key ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <Badge status={lic.status} />
                        </td>
                        <td className="px-8 py-5">
                          {lic.machine_fingerprint ? (
                            <code className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono truncate max-w-[140px] inline-block border border-slate-200">
                              {lic.machine_fingerprint}
                            </code>
                          ) : (
                            <span className="text-xs text-slate-300 font-medium italic">Wating for registration...</span>
                          )}
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-sm font-bold text-slate-600">{format(new Date(lic.created_at), 'yyyy/MM/dd')}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{format(new Date(lic.created_at), 'HH:mm')}</p>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => fetchDetail(lic.id)}
                              title="查看详情"
                              className="p-2.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:shadow-sm transition-all"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            {lic.status === 'used' && (
                              <button
                                onClick={() => handleUnbind(lic.id)}
                                title="断开硬件绑定"
                                className="p-2.5 rounded-xl text-amber-500 hover:bg-amber-50 hover:shadow-sm transition-all"
                              >
                                <Unlink className="w-5 h-5" />
                              </button>
                            )}
                            {lic.status !== 'revoked' && (
                              <button
                                onClick={() => handleRevoke(lic.id)}
                                title="吊销此授权"
                                className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 hover:shadow-sm transition-all"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    当前显示
                  </p>
                  <p className="text-xs font-bold text-slate-600">
                    第 {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} 条 (共 {total} 条)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-blue-600 hover:bg-white border border-slate-200 bg-white transition-all shadow-sm disabled:opacity-30 text-xs font-bold"
                    title="首页"
                  >
                    «
                  </button>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="h-10 px-4 flex items-center gap-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-white border border-slate-200 bg-white transition-all shadow-sm disabled:opacity-30 text-xs font-bold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </button>

                  {/* Numeric Pages */}
                  <div className="flex items-center gap-1 mx-2">
                    {(() => {
                      const maxPages = Math.ceil(total / 20);
                      if (maxPages <= 1) return null;

                      let startPage = Math.max(1, page - 2);
                      let endPage = Math.min(maxPages, startPage + 4);
                      if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

                      const pages = [];
                      for (let p = startPage; p <= endPage; p++) {
                        pages.push(p);
                      }

                      return pages.map(p => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-xl text-xs font-bold transition-all shadow-sm border",
                            page === p
                              ? "bg-blue-600 text-white border-blue-600 shadow-blue-100"
                              : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                          )}
                        >
                          {p}
                        </button>
                      ));
                    })()}
                  </div>

                  <button
                    disabled={page * 20 >= total}
                    onClick={() => setPage(p => p + 1)}
                    className="h-10 px-4 flex items-center gap-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-white border border-slate-200 bg-white transition-all shadow-sm disabled:opacity-30 text-xs font-bold"
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page * 20 >= total}
                    onClick={() => setPage(Math.ceil(total / 20))}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-blue-600 hover:bg-white border border-slate-200 bg-white transition-all shadow-sm disabled:opacity-30 text-xs font-bold"
                    title="尾页"
                  >
                    »
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prompts' && <PromptManagement />}
        </div>
      </main>

      {/* Detail Modal */}
      {detailLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailLicense(null)}>
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">授权详情</h3>
              <button onClick={() => setDetailLicense(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">授权序列码</p>
                <code className="text-base font-mono text-blue-600 font-bold tracking-tight">{detailLicense.key}</code>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">状态</p>
                  <Badge status={detailLicense.status} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">批次</p>
                  <p className="text-sm font-medium text-slate-700">{detailLicense.generated_by || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">签发时间</p>
                  <p className="text-sm font-medium text-slate-700">{detailLicense.created_at ? format(new Date(detailLicense.created_at), 'yyyy/MM/dd HH:mm') : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">激活时间</p>
                  <p className="text-sm font-medium text-slate-700">{detailLicense.used_at ? format(new Date(detailLicense.used_at), 'yyyy/MM/dd HH:mm') : '—'}</p>
                </div>
              </div>
              {detailLicense.revoked_at && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">撤销时间</p>
                  <p className="text-sm font-medium text-rose-600">{format(new Date(detailLicense.revoked_at), 'yyyy/MM/dd HH:mm')}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">硬件指纹</p>
                {detailLicense.machine_fingerprint ? (
                  <code className="text-sm font-mono text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 inline-block">{detailLicense.machine_fingerprint}</code>
                ) : (
                  <p className="text-sm text-slate-400 italic">尚未绑定设备</p>
                )}
              </div>
              <div className="flex items-center gap-3 pt-2">
                {detailLicense.status === 'used' && (
                  <button
                    onClick={() => { handleUnbind(detailLicense.id); setDetailLicense(null); }}
                    className="flex-1 py-3 rounded-xl border border-amber-200 text-amber-600 font-bold hover:bg-amber-50 transition-all text-sm"
                  >
                    解绑设备
                  </button>
                )}
                {detailLicense.status !== 'revoked' && (
                  <button
                    onClick={() => { handleRevoke(detailLicense.id); setDetailLicense(null); }}
                    className="flex-1 py-3 rounded-xl border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-all text-sm"
                  >
                    吊销授权
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
