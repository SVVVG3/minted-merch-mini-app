export function ErrorMessage({ message, type = 'error' }) {
  if (!message) return null;

  const styles = {
    error: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-green-50 border-green-200 text-green-700'
  };

  return (
    <div className={`p-4 rounded-lg border ${styles[type]} text-sm`}>
      {message}
    </div>
  );
}