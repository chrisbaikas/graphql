PORT ?= 8042

run:
	python3 -m http.server $(PORT)

serve: run

# Helper, data and GraphQL transport regression tests.
# Node's built-in runner — no dependencies, nothing to install.
test:
	node --test tests/*.test.js

check: test
	@for file in js/*.js js/*/*.js; do node --input-type=module --check < "$$file" || exit 1; done

.PHONY: run serve test check
