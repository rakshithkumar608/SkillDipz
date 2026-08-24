import asyncio
import json
import sys
import time
import tempfile
import os
from typing import List, Dict, Any, Optional

PYTHON_HARNESS_TEMPLATE = """
import sys
import json
import time

# User Code Start
{user_code}
# User Code End

def _run_tests():
    test_cases = {test_cases_json}
    fn_name = "{function_name}"
    
    # Try finding the target function in global scope or Solution class
    target_fn = None
    if "Solution" in globals() and hasattr(Solution, fn_name):
        sol_instance = Solution()
        target_fn = getattr(sol_instance, fn_name)
    elif fn_name in globals() and callable(globals()[fn_name]):
        target_fn = globals()[fn_name]
    else:
        # Fallback to any callable defined
        callables = [f for name, f in globals().items() if callable(f) and not name.startswith("_") and name != "Solution"]
        if callables:
            target_fn = callables[-1]

    if not target_fn:
        print(json.dumps({{"error": f"Function '{{fn_name}}' not found in solution."}}))
        return

    results = []
    for i, tc in enumerate(test_cases):
        args = tc.get("input", [])
        expected = tc.get("expected")
        if not isinstance(args, list):
            args = [args]

        start_t = time.perf_counter()
        try:
            actual = target_fn(*args)
            duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
            passed = (actual == expected)
            results.append({
                "case_index": i + 1,
                "passed": passed,
                "input": args,
                "expected": expected,
                "actual": actual,
                "runtime_ms": duration_ms,
                "error": None
            })
        except Exception as e:
            duration_ms = round((time.perf_counter() - start_t) * 1000, 2)
            results.append({
                "case_index": i + 1,
                "passed": False,
                "input": args,
                "expected": expected,
                "actual": None,
                "runtime_ms": duration_ms,
                "error": str(e)
            })

    print("___RESULT_JSON_START___")
    print(json.dumps(results))
    print("___RESULT_JSON_END___")

if __name__ == "__main__":
    _run_tests()
"""

JS_HARNESS_TEMPLATE = """
// User Code Start
{user_code}
// User Code End

function _runTests() {
    const testCases = {test_cases_json};
    const fnName = "{function_name}";
    
    let targetFn = null;
    if (typeof global[fnName] === 'function') {
        targetFn = global[fnName];
    } else if (typeof solve === 'function') {
        targetFn = solve;
    } else if (typeof solution === 'function') {
        targetFn = solution;
    }

    if (!targetFn) {
        console.log(JSON.stringify({error: `Function '${fnName}' not found in solution.`}));
        return;
    }

    const results = [];
    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        let args = tc.input || [];
        if (!Array.isArray(args)) args = [args];
        const expected = tc.expected;

        const startT = performance.now();
        try {
            const actual = targetFn(...args);
            const durationMs = Math.round((performance.now() - startT) * 100) / 100;
            const passed = JSON.stringify(actual) === JSON.stringify(expected);
            results.push({
                case_index: i + 1,
                passed: passed,
                input: args,
                expected: expected,
                actual: actual,
                runtime_ms: durationMs,
                error: null
            });
        } catch (err) {
            const durationMs = Math.round((performance.now() - startT) * 100) / 100;
            results.push({
                case_index: i + 1,
                passed: false,
                input: args,
                expected: expected,
                actual: null,
                runtime_ms: durationMs,
                error: err.message
            });
        }
    }

    console.log("___RESULT_JSON_START___");
    console.log(JSON.stringify(results));
    console.log("___RESULT_JSON_END___");
}

_runTests();
"""


async def execute_code(
    language: str,
    code: str,
    test_cases: List[Dict[str, Any]],
    function_name: str = "solve",
    timeout_secs: float = 4.0,
) -> Dict[str, Any]:
    """
    Executes student code against test cases in an isolated subprocess.
    Returns per-test-case validation, runtime metrics, and overall status.
    """
    lang = language.lower().strip()
    is_python = "python" in lang or "py" in lang
    is_js = "javascript" in lang or "js" in lang or "node" in lang or "typescript" in lang

    if not is_python and not is_js:
        # Default to python if unspecified
        is_python = True

    tc_json = json.dumps(test_cases)
    
    if is_python:
        harness = (
            PYTHON_HARNESS_TEMPLATE
            .replace("{user_code}", code)
            .replace("{test_cases_json}", tc_json)
            .replace("{function_name}", function_name)
        )
        suffix = ".py"
        executable = sys.executable
    else:
        harness = (
            JS_HARNESS_TEMPLATE
            .replace("{user_code}", code)
            .replace("{test_cases_json}", tc_json)
            .replace("{function_name}", function_name)
        )
        suffix = ".js"
        executable = "node"

    # Write temporary file
    temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False, mode="w", encoding="utf-8")
    try:
        temp_file.write(harness)
        temp_file.close()

        # Run subprocess
        proc = await asyncio.create_subprocess_exec(
            executable,
            temp_file.name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=timeout_secs
            )
            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except Exception:
                pass
            return {
                "status": "TIME_LIMIT_EXCEEDED",
                "message": f"Time Limit Exceeded (> {timeout_secs}s)",
                "total_cases": len(test_cases),
                "passed_cases": 0,
                "runtime_ms": int(timeout_secs * 1000),
                "results": [],
            }

        # Parse results from stdout
        if "___RESULT_JSON_START___" in stdout:
            parts = stdout.split("___RESULT_JSON_START___")[1].split("___RESULT_JSON_END___")[0].strip()
            results = json.loads(parts)
            passed_count = sum(1 for r in results if r.get("passed"))
            total_count = len(results)
            total_runtime = sum(r.get("runtime_ms", 0) for r in results)

            overall_status = "ACCEPTED" if (passed_count == total_count and total_count > 0) else "WRONG_ANSWER"
            if any(r.get("error") for r in results):
                overall_status = "RUNTIME_ERROR"

            return {
                "status": overall_status,
                "message": "All test cases passed! 🎉" if overall_status == "ACCEPTED" else f"{passed_count}/{total_count} test cases passed.",
                "total_cases": total_count,
                "passed_cases": passed_count,
                "runtime_ms": round(total_runtime, 1),
                "results": results,
                "stdout": stdout.split("___RESULT_JSON_START___")[0].strip(),
            }
        else:
            return {
                "status": "RUNTIME_ERROR",
                "message": stderr.strip() or stdout.strip() or "Runtime error occurred during execution.",
                "total_cases": len(test_cases),
                "passed_cases": 0,
                "runtime_ms": 0,
                "results": [],
                "stderr": stderr,
            }
    except Exception as e:
        return {
            "status": "RUNTIME_ERROR",
            "message": str(e),
            "total_cases": len(test_cases),
            "passed_cases": 0,
            "runtime_ms": 0,
            "results": [],
        }
    finally:
        if os.path.exists(temp_file.name):
            try:
                os.remove(temp_file.name)
            except Exception:
                pass
