package health

import "sync"

// ComponentState represents the readiness of a component.
type ComponentState struct {
	Ready   bool   `json:"ready"`
	Message string `json:"message,omitempty"`
}

// Readiness tracks readiness for system components.
type Readiness struct {
	mu         sync.RWMutex
	components map[string]ComponentState
}

func NewReadiness() *Readiness {
	return &Readiness{
		components: make(map[string]ComponentState),
	}
}

// Set updates readiness state for a component.
func (r *Readiness) Set(component string, ready bool, message string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.components[component] = ComponentState{
		Ready:   ready,
		Message: message,
	}
}

// MarkReady marks a component as ready with a default message.
func (r *Readiness) MarkReady(component string) {
	r.Set(component, true, "running")
}

// MarkNotReady marks a component as not ready with the provided reason.
func (r *Readiness) MarkNotReady(component, reason string) {
	if reason == "" {
		reason = "stopped"
	}
	r.Set(component, false, reason)
}

// Snapshot returns a copy of the readiness map.
func (r *Readiness) Snapshot() map[string]ComponentState {
	r.mu.RLock()
	defer r.mu.RUnlock()

	out := make(map[string]ComponentState, len(r.components))
	for k, v := range r.components {
		out[k] = v
	}
	return out
}

// Ready returns true if every registered component is ready.
func (r *Readiness) Ready() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.components) == 0 {
		return false
	}
	for _, state := range r.components {
		if !state.Ready {
			return false
		}
	}
	return true
}
