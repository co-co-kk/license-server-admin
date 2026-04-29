import { useState, useEffect } from 'react';
import {
  Search,
  Eye,
  Trash2,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  MessageSquare,
  FileText,
  Cpu,
  Key,
  ArrowDown,
  ArrowUp,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusLabels: Record<string, string> = {
  pending: '待处理',
  reviewed: '已审阅',
  archived: '已归档',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  reviewed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  archived: 'bg-slate-50 text-slate-700 border-slate-100',
};

interface PromptRecord {
  id: number;
  license_key: string;
  machine_code: string;
  prompt_content: string | null;
  report_content: string;
  input_tokens: number;
  output_tokens: number;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function PromptManagement() {
  const [stats, setStats] = useState<any>(null);
  const [records, setRecords] = useState<PromptRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState<PromptRecord | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/prompts/stats');
      const data = await res.json();
      if (data.code === 0) setStats(data.data);
    } catch (e) { /* ignore */ }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/prompts?page=${page}`;
      if (search) url += `&search=${search}`;
      if (statusFilter && statusFilter !== 'all') url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 0) {
        setRecords(data.data.list);
        setTotal(data.data.total);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    fetchRecords();
  }, [page, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchRecords();
  };

  const handleViewDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/prompts/${id}`);
      const data = await res.json();
      if (data.code === 0) {
        setDetailRecord(data.data);
        setEditNotes(data.data.admin_notes || '');
        setEditStatus(data.data.status);
      }
    } catch (e) { /* ignore */ }
  };

  const handleSave = async () => {
    if (!detailRecord) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prompts/${detailRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus, admin_notes: editNotes })
      });
      const data = await res.json();
      if (data.code === 0) {
        setDetailRecord(data.data);
        fetchStats();
        fetchRecords();
      }
    } catch (e) { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此记录吗？此操作不可恢复。')) return;
    await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' });
    setDetailRecord(null);
    fetchStats();
    fetchRecords();
  };

  const statusTabs = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待处理' },
    { value: 'reviewed', label: '已审阅' },
    { value: 'archived', label: '已归档' },
  ];

  const truncate = (text: string, len: number) =>
    text.length > len ? text.slice(0, len) + '...' : text;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <p className="text-sm text-slate-500 font-medium">待处理</p>
            </div>
            <span className="text-3xl font-bold text-slate-900 tracking-tight">{stats.pending}</span>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="w-5 h-5 text-emerald-500" />
              <p className="text-sm text-slate-500 font-medium">已审阅</p>
            </div>
            <span className="text-3xl font-bold text-slate-900 tracking-tight">{stats.reviewed}</span>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-slate-500" />
              <p className="text-sm text-slate-500 font-medium">已归档</p>
            </div>
            <span className="text-3xl font-bold text-slate-900 tracking-tight">{stats.archived}</span>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <p className="text-sm text-slate-500 font-medium">总计</p>
            </div>
            <span className="text-3xl font-bold text-slate-900 tracking-tight">{stats.total}</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
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
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索提示词内容..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                className="w-full pl-11 pr-5 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-medium text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-bold tracking-widest uppercase italic">Total: {total} Records</span>
            <button
              onClick={() => { fetchStats(); fetchRecords(); }}
              className="px-4 py-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-all border border-slate-200 bg-white shadow-sm flex items-center gap-2 text-sm font-medium"
            >
              <RefreshCcw className="w-4 h-4" />
              刷新
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-4">提示词预览</th>
                <th className="px-8 py-4">报告预览</th>
                <th className="px-8 py-4">Token 用量</th>
                <th className="px-8 py-4">卡密</th>
                <th className="px-8 py-4">机器码</th>
                <th className="px-8 py-4">状态</th>
                <th className="px-8 py-4">提交时间</th>
                <th className="px-8 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-8 py-12 text-center text-slate-400 text-sm">加载中...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-8 py-12 text-center text-slate-400 text-sm">暂无提示词记录</td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/40 transition-colors group">
                    <td className="px-8 py-5 max-w-[240px]">
                      <p className="text-sm text-slate-700 truncate font-medium">{record.prompt_content ? truncate(record.prompt_content, 50) : <span className="text-slate-400 italic">使用系统默认提示词</span>}</p>
                    </td>
                    <td className="px-8 py-5 max-w-[240px]">
                      <p className="text-sm text-slate-500 truncate">{truncate(record.report_content, 50)}</p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-blue-600 font-medium">
                          <ArrowDown className="w-3 h-3" />{record.input_tokens.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <ArrowUp className="w-3 h-3" />{record.output_tokens.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <code className="text-xs font-mono text-blue-600 font-bold tracking-tight">{record.license_key}</code>
                    </td>
                    <td className="px-8 py-5">
                      <code className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 font-mono truncate max-w-[120px] inline-block border border-slate-200">
                        {record.machine_code}
                      </code>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wider", statusColors[record.status])}>
                        {statusLabels[record.status]}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-bold text-slate-600">{format(new Date(record.created_at), 'yyyy/MM/dd')}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{format(new Date(record.created_at), 'HH:mm')}</p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewDetail(record.id)}
                          title="查看详情"
                          className="p-2.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 hover:shadow-sm transition-all"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          title="删除"
                          className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 hover:shadow-sm transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">当前显示</p>
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
            <div className="flex items-center gap-1 mx-2">
              {(() => {
                const maxPages = Math.ceil(total / 20);
                if (maxPages <= 1) return null;
                let startPage = Math.max(1, page - 2);
                let endPage = Math.min(maxPages, startPage + 4);
                if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
                const pages = [];
                for (let p = startPage; p <= endPage; p++) pages.push(p);
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

      {/* Detail Modal */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDetailRecord(null)}>
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-800 text-lg">提示词详情</h3>
              <button onClick={() => setDetailRecord(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-5 overflow-y-auto flex-1">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" />提示词内容
                </p>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{detailRecord.prompt_content || '（用户未提供自定义提示词，使用系统默认提示词）'}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <FileText className="w-3 h-3" />总结报告
                </p>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{detailRecord.report_content}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Key className="w-3 h-3" />卡密
                  </p>
                  <code className="text-sm font-mono text-blue-600 font-bold tracking-tight">{detailRecord.license_key}</code>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Cpu className="w-3 h-3" />机器码
                  </p>
                  <code className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 inline-block">{detailRecord.machine_code}</code>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Token 用量</p>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-xl border border-blue-100">
                    <ArrowDown className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-[10px] text-blue-500 font-bold uppercase">输入</p>
                      <p className="text-lg font-bold text-blue-700">{detailRecord.input_tokens.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <ArrowUp className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">输出</p>
                      <p className="text-lg font-bold text-emerald-700">{detailRecord.output_tokens.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">合计</p>
                      <p className="text-lg font-bold text-slate-700">{(detailRecord.input_tokens + detailRecord.output_tokens).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">状态</p>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-medium text-sm bg-white"
                >
                  <option value="pending">待处理</option>
                  <option value="reviewed">已审阅</option>
                  <option value="archived">已归档</option>
                </select>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">管理员备注</p>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all text-sm resize-y"
                  placeholder="添加备注信息..."
                />
              </div>

              <div className="grid grid-cols-2 gap-5 text-xs text-slate-400">
                <div>
                  <p className="font-bold text-slate-500">提交时间: {format(new Date(detailRecord.created_at), 'yyyy/MM/dd HH:mm')}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-500">更新时间: {format(new Date(detailRecord.updated_at), 'yyyy/MM/dd HH:mm')}</p>
                </div>
              </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 flex items-center gap-3 bg-slate-50 flex-shrink-0">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => handleDelete(detailRecord.id)}
                className="px-6 py-3 rounded-xl border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-all text-sm"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
