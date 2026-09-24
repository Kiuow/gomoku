const NotFound = () => {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-foreground">
      <h1 className="text-3xl font-bold">页面不存在</h1>
      <a className="text-primary underline" href="/">返回首页</a>
    </main>
  );
};

export default NotFound;
