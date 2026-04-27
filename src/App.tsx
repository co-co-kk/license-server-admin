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
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  const [loading, setLoading] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [generateBatch, setGenerateBatch] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.code === 0) setStats(data.data);
    } catch (e) { console.error(e); }
  };

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/licenses?page=${page}&search=${search}`);
      const data = await res.json();
      if (data.code === 0) {
        setLicenses(data.data.list);
        setTotal(data.data.total);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    fetchLicenses();
  }, [page]);

  const handleGenerate = async () => {
    try {
      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: generateCount, batch: generateBatch })
      });
      const data = await res.json();
      if (data.code === 0) {
        setActiveTab('list');
        setPage(1);
        fetchLicenses();
        fetchStats();
        alert(`成功生成 ${data.data.count} 个卡密`);
      }
    } catch (e) { alert('生成失败'); }
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
            </h1>
            <p className="text-slate-400 text-sm">
              {activeTab === 'dashboard' && '实时监测授权分发与激活状态'}
              {activeTab === 'generate' && '配置并生成新的永久性授权密钥'}
              {activeTab === 'list' && '管理已签发的授权，进行吊销或解绑操作'}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { fetchStats(); fetchLicenses(); }}
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
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-200 p-10 space-y-8 animate-in slide-in-from-bottom-8 duration-500">
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
          )}

          {activeTab === 'list' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
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
        </div>
      </main>
    </div>
  );
}
