import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  BookOpen,
  Trash2,
  Plus,
  ArrowLeft,
  Upload,
  AlertTriangle,
  X,
  Download,
  Settings2,
} from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import { ThemeToggle } from '@client/src/components/ui/theme-toggle';
import {
  loadKifuList,
  deleteKifu,
  clearAllKifu,
  sgfToKifu,
  saveKifu,
  isKifuFull,
  KIFU_MAX_RECORDS,
  type KifuRecord,
} from '@client/src/utils/kifu';

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const modeLabels: Record<string, string> = {
  solo: '单人模式',
  online: '联机对战',
  practice: '双人练习',
  free: '自由摆盘',
};

const resultLabels: Record<string, { text: string; color: string }> = {
  black: { text: '黑胜', color: 'text-foreground' },
  white: { text: '白胜', color: 'text-muted-foreground' },
  draw: { text: '平局', color: 'text-muted-foreground' },
  unknown: { text: '未结束', color: 'text-muted-foreground' },
};

const KifuListPage: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<KifuRecord[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setRecords(loadKifuList());
  }, []);

  const handleImport = () => {
    if (!importText.trim()) {
      toast.error('请粘贴棋谱内容');
      return;
    }
    const parsed = sgfToKifu(importText);
    if (!parsed) {
      toast.error('棋谱格式不正确，请检查 SGF 格式');
      return;
    }
    if (isKifuFull()) {
      toast.error(`棋谱已达上限（${KIFU_MAX_RECORDS}个），请先清理旧棋谱`);
      return;
    }
    const newRecord = saveKifu(parsed);
    setRecords(loadKifuList());
    setImportOpen(false);
    setImportText('');
    toast.success('导入成功');
    navigate(`/kifu/${newRecord.id}`);
  };

  const handleDelete = (id: string) => {
    deleteKifu(id);
    setRecords(loadKifuList());
    setDeleteId(null);
    toast.success('已删除');
  };

  const handleClearAll = () => {
    clearAllKifu();
    setRecords([]);
    setClearOpen(false);
    toast.success('已清空所有棋谱');
  };

  const cardStagger = [0, 0.05, 0.1, 0.15, 0.2];

  return (
    <div className="min-h-screen w-full p-4 sm:p-6 bg-background text-foreground">
      <motion.div
        className="w-full max-w-xl mx-auto space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">我的棋谱</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 h-11 rounded-xl"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="w-4 h-4" />
            导入棋谱
          </Button>
          <Button
            variant="secondary"
            className="flex-1 h-11 rounded-xl"
            onClick={() => navigate('/practice')}
          >
            <Settings2 className="w-4 h-4" />
            练习模式
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            共 {records.length} / {KIFU_MAX_RECORDS} 局
          </p>
          {records.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearOpen(true)}
              className="text-destructive h-8 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {records.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-card/60 border border-border/60 rounded-2xl p-10 text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
                    <BookOpen className="w-7 h-7 text-muted-foreground/60" />
                  </div>
                </div>
                <p className="text-base text-foreground font-medium">还没有棋谱</p>
                <p className="text-sm text-muted-foreground mt-1">
                  对局结束后可以保存棋谱，也可以导入 SGF 棋谱
                </p>
              </motion.div>
            ) : (
              records.map((record, idx) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{
                    duration: 0.3,
                    delay: cardStagger[Math.min(idx, cardStagger.length - 1)],
                  }}
                  layout
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/kifu/${record.id}`)}
                    className="w-full text-left bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground truncate">
                          {record.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-muted-foreground">
                            {modeLabels[record.mode] || record.mode}
                          </span>
                          <span className="text-xs text-muted-foreground/40">·</span>
                          <span
                            className={`text-xs font-medium ${
                              resultLabels[record.result]?.color ||
                              'text-muted-foreground'
                            }`}
                          >
                            {resultLabels[record.result]?.text || record.result}
                          </span>
                          <span className="text-xs text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground">
                            {record.moveCount} 手
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/70 mt-1.5">
                          {formatDate(record.createdAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          setDeleteId(record.id);
                        }}
                        className="rounded-xl text-muted-foreground/50 hover:text-destructive -mr-2 -mt-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">导入棋谱</DialogTitle>
            <DialogDescription className="text-sm">
              粘贴 SGF 格式棋谱文本，导入后可回放研究
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={importText}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setImportText(e.target.value)
              }
              placeholder="粘贴 SGF 棋谱内容..."
              className="min-h-[200px] rounded-xl font-mono text-sm bg-input border-input"
            />
            {isKifuFull() && (
              <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 p-3 rounded-xl">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  棋谱已达 {KIFU_MAX_RECORDS} 个上限，请先删除旧棋谱再导入
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row gap-2 sm:flex-row">
            <Button
              variant="secondary"
              onClick={() => {
                setImportOpen(false);
                setImportText('');
              }}
              className="flex-1 rounded-xl border-border"
            >
              取消
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importText.trim() || isKifuFull()}
              className="flex-1 rounded-xl bg-primary text-primary-foreground"
            >
              <Download className="w-4 h-4" />
              导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent className="rounded-2xl bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              确认清空所有棋谱？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              清空后无法恢复，请确认操作
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
            <AlertDialogCancel className="flex-1 rounded-xl border-border">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="flex-1 rounded-xl bg-destructive text-destructive-foreground border-destructive-border"
            >
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              删除这局棋谱？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              删除后无法恢复
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
            <AlertDialogCancel className="flex-1 rounded-xl border-border">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="flex-1 rounded-xl bg-destructive text-destructive-foreground border-destructive-border"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default KifuListPage;
