PORT ?= 8042

run:
	python3 -m http.server $(PORT)

serve: run

# Unit tests for the pure helpers (formatting, JWT, auth, fetch timeout).
# Node's built-in runner — no dependencies, nothing to install.
test:
	node --test 'tests/*.test.js'

.PHONY: run serve test
