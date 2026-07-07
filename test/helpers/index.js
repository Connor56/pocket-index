/*
  Shared test helpers live here.

  Common helpers in Holepunch modules include:
  - create(t, opts): construct the module and register teardown
  - collect(stream): gather stream data into an array
  - createStored(t): create temporary on-disk state for persistence tests
  - replicate(a, b): connect two peers/cores/resources in tests

  Keep helpers small and specific to this package's test suite.
*/
