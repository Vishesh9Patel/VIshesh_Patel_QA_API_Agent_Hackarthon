# Restful Booker API Test Cases

This document is a sample QA artifact for the public Restful Booker demo API.

## Test Case Format

- **Test ID**
- **Summary**
- **Preconditions**
- **Steps to Reproduce**
- **Expected Result**
- **Actual Result**
- **Status**

## Sample

### TC_PING_001 - Health Check - Happy Path

- **Summary:** Check that the API health endpoint responds successfully.
- **Preconditions:** Public demo API is reachable.
- **Steps to Reproduce:**
  1. Send GET request to `/ping`.
  2. Capture the HTTP response.
  3. Record response time and body.
- **Expected Result:** API returns the documented success status and body.
- **Actual Result:** Filled during execution.
- **Status:** PASS/FAIL
