
## Required test-first ordering

Tests for new or changed runtime behavior are mandatory even if the core task
template describes tests as optional. Organize tasks into small behavior slices:

1. Write the slice's test and observe failure for its intended missing behavior.
2. Implement the smallest change that makes it pass.
3. Refactor, rerun relevant checks and record Red/Green evidence.
4. Continue with the next slice; do not batch all failing tests before implementing.
5. Run affected feedback and all applicable final gates before closing the feature.

Each test has one owning suite and may cover several criteria. Order test work
before its implementation. Mark tasks complete only with actual evidence.
Infrastructure gets executable validation; prose-only work needs no dummy test.
