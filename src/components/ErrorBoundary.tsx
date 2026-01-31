import * as React from "react";

import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled render error:", error, info);
  }

  private handleReload = () => {
    // Force a clean reload in case the bundle got into a bad HMR state
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-background">
        <main className="container py-12">
          <div className="mx-auto max-w-2xl space-y-4">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground">
              The app hit a runtime error while rendering. Reload to recover.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <p className="font-mono text-sm break-words">{this.state.error.message}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={this.handleReload}>Reload</Button>
              <Button variant="outline" onClick={() => this.setState({ error: null })}>
                Try again
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }
}
