interface Props {
  progress: string;
}

export function LoadingScreen({ progress }: Props) {
  return (
    <div className="panel loading-screen">
      <div className="loading-content">
        <div className="spinner" />
        <p className="loading-text">{progress || 'Processing...'}</p>
      </div>
    </div>
  );
}
