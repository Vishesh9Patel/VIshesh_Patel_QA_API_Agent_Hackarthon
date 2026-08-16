# Excel Test Suite

QA API Agent supports importing `.xlsx`, `.xls`, and `.csv` files from the **Import Excel** button.

Required columns:
- Test ID
- Method
- Endpoint
- Expected Status

Optional columns:
- Category
- Description
- Headers
- Request Body
- Expected Result
- Priority
- AI Scenario

The included `API_Sentinel_AI_Demo_Test_Suite.xlsx` contains 20 demo scenarios covering GET, POST, PUT, PATCH, DELETE, negative testing, authentication, performance, and contract checks.

Imported cases are kept in the browser session and can be:
1. Loaded individually into **New API check**
2. Executed one-by-one with **Run API**
3. Executed sequentially with **Run All**
4. Analysed with **Analyse with AI**
5. Analysed sequentially with **AI Analyse All**

Execution history is stored in localStorage for the hackathon demo.
