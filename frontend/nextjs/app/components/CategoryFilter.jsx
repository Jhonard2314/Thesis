'use client';

export default function CategoryFilter({ activeCategory, onCategoryChange }) {
  const categories = [
    { id: 'general',       name: 'General' },
    { id: 'business',      name: 'Business' },
    { id: 'technology',    name: 'Technology' },
    { id: 'entertainment', name: 'Entertainment' },
    { id: 'health',        name: 'Health' },
    { id: 'science',       name: 'Science' },
    { id: 'sports',        name: 'Sports' },
  ];

  return (
    <nav aria-label="Categories">
      <ol className="flex items-center flex-wrap gap-1 text-sm">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <li key={cat.id}>
              <button
                onClick={() => onCategoryChange(cat.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all focus:outline-none"
                style={isActive
                  ? { background: 'var(--accent)', border: '1px solid var(--accent)', color: '#FFFFFF' }
                  : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)' }
                }
              >
                {cat.name}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
