export default function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden animate-pulse" style={{ background: '#112240' }}>
          <div className="w-full h-44" style={{ background: '#1A2D4A' }}/>
          <div className="p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-3 rounded w-24" style={{ background: '#1E3A5F' }}/>
              <div className="h-3 rounded w-16" style={{ background: '#1E3A5F' }}/>
            </div>
            <div className="h-4 rounded w-full"  style={{ background: '#1E3A5F' }}/>
            <div className="h-4 rounded w-3/4"   style={{ background: '#1E3A5F' }}/>
            <div className="h-3 rounded w-full"  style={{ background: '#1E3A5F' }}/>
            <div className="h-3 rounded w-5/6"   style={{ background: '#1E3A5F' }}/>
          </div>
        </div>
      ))}
    </div>
  );
}
