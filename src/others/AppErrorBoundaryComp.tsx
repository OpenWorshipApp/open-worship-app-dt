import { Component, type ErrorInfo, type ReactNode } from 'react';

import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';

/**
 * The only error boundary in the app, and it exists because there were none.
 *
 * A render-time throw anywhere under a route took the WHOLE window with it:
 * React unmounts the tree to the root, so the user is left with a blank window
 * that still has no header to navigate away from, and (packaged) no console
 * anyone will ever read. `AppEditableDocumentSourceAbs._getInstance` throws on
 * an extension mismatch, which is one way to reach exactly that -- seen once on
 * a dev build with a `.owl` selected and never reproduced, which is precisely
 * the kind of failure a boundary is for: it cannot be relied on not to happen.
 *
 * Keep the fallback tiny and dependency-free: it renders in a subtree that has
 * just proven it can throw.
 */
type PropsType = Readonly<{ children: ReactNode }>;
type StateType = { error: Error | null };

export default class AppErrorBoundaryComp extends Component<
    PropsType,
    StateType
> {
    constructor(props: PropsType) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): StateType {
        return { error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        handleError(error);
        handleError(errorInfo.componentStack ?? '');
    }

    handleRetrying = () => {
        this.setState({ error: null });
    };

    render() {
        const { error } = this.state;
        if (error === null) {
            return this.props.children;
        }
        return (
            <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center p-2">
                <div className="alert alert-warning" role="alert">
                    <div>
                        <i className="bi bi-exclamation-triangle me-1" />
                        <span>{tran('Something went wrong here')}</span>
                    </div>
                    <div className="app-ellipsis" title={`${error.message}`}>
                        <small>{`${error.message}`}</small>
                    </div>
                </div>
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={this.handleRetrying}
                >
                    {tran('Try Again')}
                </button>
            </div>
        );
    }
}
