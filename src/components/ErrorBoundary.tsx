import { Component, type ReactNode } from 'react';

/** Keeps one broken page from blanking the whole shell; resets when the route changes. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error)
      return (
        <div className="card">
          <div className="empty">
            This view hit an error and could not render.
            <div className="mono muted" style={{ marginTop: 8 }}>{this.state.error.message}</div>
          </div>
        </div>
      );
    return this.props.children;
  }
}
