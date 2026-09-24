import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { User, PlusCircle, LogIn, ChevronDown, BookOpen, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { ThemeToggle } from '@client/src/components/ui/theme-toggle';
import { gomoku } from '@client/src/api';
import type { PlayerColor } from '@shared/api.interface';

const PLAYER_ID_KEY = 'gomoku_player_id';

function getPlayerId(): string {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

const ROOM_CODE_PATTERN = /^[A-Za-z0-9]{4,20}$/;

interface ColorSelectorProps {
  value: PlayerColor;
  onChange: (color: PlayerColor) => void;
}

function ColorSelector({ value, onChange }: ColorSelectorProps) {
  const pieces: Array<{ color: PlayerColor; label: string; sub: string }> = [
    { color: 'black', label: '黑棋', sub: '先手' },
    { color: 'white', label: '白棋', sub: '后手' },
  ];

  return (
    <div className="flex items-center justify-center gap-6">
      {pieces.map((p) => {
        const isActive = value === p.color;
        return (
          <button
            key={p.color}
            type="button"
            onClick={() => onChange(p.color)}
            className="flex flex-col items-center gap-2 group"
          >
            <div
              className={`relative w-12 h-12 rounded-full transition-all duration-200 ${
                isActive
                  ? 'ring-[3px] ring-[color:hsl(var(--color-gold))] ring-offset-2 ring-offset-background scale-105'
                  : 'opacity-70 group-hover:opacity-100'
              }`}
              style={{
                background:
                  p.color === 'black'
                    ? 'radial-gradient(circle at 35% 28%, #6a6a6a 0%, #3a3a3a 35%, #1a1a1a 75%, #0a0a0a 100%)'
                    : 'radial-gradient(circle at 35% 28%, #ffffff 0%, #f5f0e8 45%, #ddd4c4 85%, #c9bea8 100%)',
                boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
              }}
            />
            <div className="text-center">
                <p className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {p.label}
                </p>
                <p className="text-xs text-muted-foreground/70">{p.sub}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}



const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [createRoomCode, setCreateRoomCode] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createColor, setCreateColor] = useState<PlayerColor>('black');
  const [activeTab, setActiveTab] = useState<'create' | 'join' | null>(null);

  useEffect(() => {
    getPlayerId();
  }, []);

  const handleCreateRoom = async () => {
    const customCode = createRoomCode.trim().toUpperCase();
    if (customCode && !ROOM_CODE_PATTERN.test(customCode)) {
      toast.error('房间号需为 4-20 位字母或数字');
      return;
    }
    setCreating(true);
    try {
      const playerId = getPlayerId();
      const payload: {
        playerId: string;
        roomCode?: string;
        playerColor?: PlayerColor;
      } = { playerId, playerColor: createColor };
      if (customCode) payload.roomCode = customCode;
      const res = await gomoku.gomokuApi.createRoom(payload);
      toast.success('房间创建成功');
      navigate(`/room/${res.room.roomCode}`);
    } catch (error: unknown) {
      logger.error('创建房间失败', error);
      const errMsg = error instanceof Error ? error.message : '';
      if (
        errMsg.includes('已占用') ||
        errMsg.includes('occupied') ||
        errMsg.includes('exist')
      ) {
        toast.error('该房间号已被占用，请更换');
      } else {
        toast.error('创建房间失败，请重试');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleWatchRoom = () => {
    const code = joinRoomCode.trim().toUpperCase();
    if (!ROOM_CODE_PATTERN.test(code)) {
      toast.error('请输入 4-20 位字母或数字房间号');
      return;
    }
    navigate(`/room/${code}?mode=watch`);
  };

  const handleJoinRoom = async () => {
    const code = joinRoomCode.trim().toUpperCase();
    if (!ROOM_CODE_PATTERN.test(code)) {
      toast.error('请输入 4-20 位字母或数字房间号');
      return;
    }
    setJoining(true);
    try {
      const playerId = getPlayerId();
      const res = await gomoku.gomokuApi.joinRoom({ roomCode: code, playerId });
      toast.success('加入房间成功');
      navigate(`/room/${res.room.roomCode}`);
    } catch (error: unknown) {
      logger.error('加入房间失败', error);
      toast.error('加入房间失败，请检查房间号');
    } finally {
      setJoining(false);
    }
  };

  const cardStagger = [0, 0.08, 0.16];

  return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-background text-foreground">
      <motion.div
        className="w-full max-w-xl space-y-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* 标题区 */}
        <div className="relative text-center space-y-2">
          <div className="absolute top-1 right-0">
            <ThemeToggle />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            五子棋
          </h1>
          <p className="text-sm text-muted-foreground">对弈，方寸之间</p>
        </div>

        {/* 单人模式 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: cardStagger[0] }}
        >
          <button
            type="button"
            onClick={() => navigate('/solo')}
            className="w-full text-left bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground">单人模式</h3>
                <p className="text-sm text-muted-foreground mt-0.5">人机对战，轻松上手</p>
              </div>
              <ChevronDown className="w-5 h-5 text-muted-foreground/70 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </motion.div>

        {/* 练习模式 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: cardStagger[0] + 0.04 }}
        >
          <button
            type="button"
            onClick={() => navigate('/practice')}
            className="w-full text-left bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground">练习模式</h3>
                <p className="text-sm text-muted-foreground mt-0.5">双人同屏 · 自由摆盘 · 棋谱研究</p>
              </div>
              <ChevronDown className="w-5 h-5 text-muted-foreground/70 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </motion.div>

        {/* 棋谱 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: cardStagger[0] + 0.08 }}
        >
          <button
            type="button"
            onClick={() => navigate('/kifu')}
            className="w-full text-left bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[hsl(var(--color-gold))]/15 text-[hsl(var(--color-gold))] flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground">我的棋谱</h3>
                <p className="text-sm text-muted-foreground mt-0.5">对局回放 · 导入导出 · 研究学习</p>
              </div>
              <ChevronDown className="w-5 h-5 text-muted-foreground/70 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </motion.div>

        {/* 创建房间 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: cardStagger[1] }}
        >
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'create' ? null : 'create')}
              className="w-full text-left p-5 group"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground">创建房间</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">创建房间邀请好友对战</p>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-muted-foreground/70 transition-transform duration-200 ${
                    activeTab === 'create' ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {activeTab === 'create' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                  <div className="px-5 pb-5 pt-1 space-y-5 border-t border-border/40">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground/70 font-medium">选择执子颜色</p>
                    <ColorSelector value={createColor} onChange={setCreateColor} />
                  </div>

                  <div className="space-y-2">
                      <p className="text-xs text-muted-foreground/70">
                        可选：自定义房间号（字母+数字，4-20位）
                      </p>
                    <Input
                      type="text"
                      placeholder="留空则自动生成"
                      value={createRoomCode}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const val = e.target.value
                          .replace(/[^A-Za-z0-9]/g, '')
                          .slice(0, 20);
                        setCreateRoomCode(val);
                      }}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') handleCreateRoom();
                      }}
                      maxLength={20}
                      className="h-11 rounded-xl bg-input border-input text-foreground focus-visible:border-primary placeholder:text-muted-foreground/70"
                    />
                  </div>
                  <Button
                    className="w-full text-base font-medium h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                    size="lg"
                    onClick={handleCreateRoom}
                    disabled={creating}
                  >
                    {creating ? '创建中...' : '创建房间'}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* 加入房间 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: cardStagger[2] }}
        >
          <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'join' ? null : 'join')}
              className="w-full text-left p-5 group"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <LogIn className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground">加入房间</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">输入房间号加入对战</p>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-muted-foreground/70 transition-transform duration-200 ${
                    activeTab === 'join' ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {activeTab === 'join' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                 <div className="px-5 pb-5 pt-1 space-y-4 border-t border-border/40">
                  <Input
                    type="text"
                    placeholder="请输入房间号"
                    value={joinRoomCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value
                        .replace(/[^A-Za-z0-9]/g, '')
                        .toUpperCase()
                        .slice(0, 20);
                      setJoinRoomCode(val);
                    }}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') handleJoinRoom();
                    }}
                    maxLength={20}
                    className="h-12 text-lg text-center tracking-wider rounded-xl bg-input border-input text-foreground focus-visible:border-primary placeholder:text-muted-foreground/70"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 text-base font-medium h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                      size="lg"
                      onClick={handleJoinRoom}
                      disabled={joining || !ROOM_CODE_PATTERN.test(joinRoomCode)}
                    >
                      {joining ? '加入中...' : '加入房间'}
                    </Button>
                    <Button
                      className="flex-1 text-base font-medium h-11 rounded-xl bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80"
                      size="lg"
                      variant="outline"
                      onClick={handleWatchRoom}
                      disabled={!ROOM_CODE_PATTERN.test(joinRoomCode)}
                    >
                      观战
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground/70 text-center">
                    观战模式只能看棋，不能落子
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* 底部装饰文字 */}
        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground/70">— 以棋会友 —</p>
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
