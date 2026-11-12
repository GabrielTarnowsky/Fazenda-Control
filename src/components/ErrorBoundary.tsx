import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary capturou erro não tratado:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white p-6">
          <div className="max-w-md w-full p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-4">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div>
              <h2 className="text-xl font-black italic tracking-tight text-white">
                Falha Temporária na Interface
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Ocorreu um erro no processamento visual. Seus dados cadastrados e histórico de pesagens continuam preservados e seguros.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-left overflow-hidden">
                <p className="text-[11px] font-mono text-rose-400 truncate">
                  {this.state.error.message || "Erro desconhecido"}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                onClick={this.handleReset}
                variant="outline"
                className="flex-1 text-xs font-bold border-slate-700 hover:bg-slate-800 text-slate-200"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Tentar Recuperar
              </Button>

              <Button
                type="button"
                onClick={this.handleReload}
                className="flex-1 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Recarregar Tela
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={this.handleGoHome}
              className="text-xs text-slate-400 hover:text-white"
            >
              <Home className="h-3.5 w-3.5 mr-1" />
              Voltar ao Início
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
