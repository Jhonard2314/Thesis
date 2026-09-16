'use client';

export default function CategoryFilter({ activeCategory, onCategoryChange }) {
  const categories = [
    { id: 'general', name: 'General'},
    { id: 'business', name: 'Business',},
    { id: 'technology', name: 'Technology'},
    { id: 'entertainment', name: 'Entertainment'},
    { id: 'health', name: 'Health'},
    { id: 'science', name: 'Science'},
    { id: 'sports', name: 'Sports'},
  ];

  return (
    <nav className="ml-10 mr-4" aria-label="Categories">
      <ol className="flex items-center justify-center text-sm text-gray-600">
        {categories.map((category, idx) => {
          const isActive = activeCategory === category.id;
          return (
            <li key={category.id} className="flex items-center">
              <button
                onClick={() => onCategoryChange(category.id)}
                className={`px-1 py-1 transition-all focus:outline-none ${
                  isActive
                    ? 'text-blue-600 border-b-2 border-blue-600 font-semibold'
                    : 'hover:text-blue-600 hover:border-b-2 hover:border-blue-600 border-b-2 border-transparent'
                }`}
              >
                <span>{category.name}</span>
              </button>

              {idx < categories.length - 1 && (
                <span className="mx-3 text-gray-400 select-none">›</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
