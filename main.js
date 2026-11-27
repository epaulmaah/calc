(function () {
  "use strict";

  var expEl = document.getElementById("expression");
  var resEl = document.getElementById("result");
  var keysEl = document.getElementById("keys");

  var state = {
    expr: "",
    evaluated: false,
    lastResult: null,
    error: "",
  };

  var OPS = "+−×÷";

  function isOp(ch) {
    return ch !== "" && OPS.indexOf(ch) !== -1;
  }

  function trailingNumber(str) {
    var m = str.match(/(\d+\.?\d*|\.\d+)$/);
    return m ? m[0] : "";
  }

  function buzz() {
    try {
      if (navigator.vibrate) navigator.vibrate(8);
    } catch (e) {}
  }

  /* ---------- expression eval ---------- */

  function evaluate(raw) {
    var e = raw
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/%/g, "/100");

    // Drop dangling operators / open parenthesis while typing.
    while (e.length && /[+\-*/.(]$/.test(e)) e = e.slice(0, -1);
    if (!e) return { value: null };

    // Auto-close unbalanced parentheses.
    var open = (e.match(/\(/g) || []).length - (e.match(/\)/g) || []).length;
    if (open > 0) e += new Array(open + 1).join(")");
    if (open < 0) return { error: true };

    if (!/^[0-9+\-*/().\s]+$/.test(e)) return { value: null };

    var v;
    try {
      v = Function('"use strict";return (' + e + ")")();
    } catch (err) {
      return { value: null };
    }
    if (typeof v !== "number" || !isFinite(v)) return { error: true };

    var rounded = parseFloat(v.toPrecision(12));
    if (Object.is(rounded, -0)) rounded = 0;
    return { value: rounded };
  }

  function formatNumber(n) {
    if (!isFinite(n)) return String(n);
    var s;
    if (Number.isInteger(n) && Math.abs(n) < 1e15) {
      s = String(n);
    } else {
      s = String(parseFloat(n.toPrecision(11)));
    }
    if (s.indexOf("e") !== -1) return s;

    var neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "−" : "") + parts.join(".");
  }

  function fitResult(text) {
    if (text.length <= 8) return 1;
    return Math.max(0.42, 1 - (text.length - 8) * 0.055);
  }

  /* ---------- rendering ---------- */

  function render() {
    if (state.error) {
      expEl.textContent = "";
      resEl.textContent = "Cannot divide by zero";
      resEl.classList.add("error");
      return;
    }

    resEl.classList.remove("error");

    var text;
    if (state.evaluated) {
      expEl.textContent = state.expr + " =";
      text = formatNumber(state.lastResult);
    } else {
      expEl.textContent = state.expr;
      if (!state.expr) {
        text = "0";
      } else {
        var r = evaluate(state.expr);
        if (r.error) {
          resEl.textContent = "Cannot divide by zero";
          resEl.classList.add("error");
          expEl.scrollLeft = expEl.scrollWidth;
          return;
        }
        text =
          r.value === null
            ? trailingNumber(state.expr) || "0"
            : formatNumber(r.value);
      }
    }

    resEl.textContent = text;
    resEl.style.setProperty("--fit", fitResult(text));
    expEl.scrollLeft = expEl.scrollWidth;
  }

  /* ---------- input handling ---------- */

  function clearAll() {
    state.expr = "";
    state.evaluated = false;
    state.lastResult = null;
    state.error = "";
    render();
  }

  function startFresh() {
    if (state.error) {
      state.error = "";
      state.expr = "";
      state.evaluated = false;
      state.lastResult = null;
      return;
    }
    if (state.evaluated) {
      state.expr = "";
      state.evaluated = false;
      state.lastResult = null;
    }
  }

  function continueFromResult() {
    if (state.error) {
      state.error = "";
      state.expr = "";
      state.evaluated = false;
      state.lastResult = null;
      return;
    }
    if (state.evaluated) {
      state.expr = String(state.lastResult).replace("-", "−");
      state.evaluated = false;
      state.lastResult = null;
    }
  }

  function inputDigit(d) {
    startFresh();
    var e = state.expr;
    var last = e.slice(-1);
    if (last === ")" || last === "%") e += "×";

    var tn = trailingNumber(e);
    if (tn === "0") {
      e = e.slice(0, -1) + d;
    } else if (tn === "" && last === ".") {
      e += d;
    } else {
      e += d;
    }
    state.expr = e;
    render();
  }

  function inputDot() {
    startFresh();
    var e = state.expr;
    var last = e.slice(-1);

    if (last === ")" || last === "%") {
      e += "×0.";
    } else {
      var tn = trailingNumber(e);
      if (tn.indexOf(".") !== -1) return;
      if (tn === "") {
        if (e === "" || isOp(last) || last === "(") e += "0.";
        else return;
      } else {
        e += ".";
      }
    }
    state.expr = e;
    render();
  }

  function inputOperator(op) {
    if (state.error) {
      clearAll();
      return;
    }
    if (state.evaluated) {
      state.expr = String(state.lastResult).replace("-", "−");
      state.evaluated = false;
      state.lastResult = null;
    }

    var e = state.expr;
    if (e === "") {
      if (op === "−") e = "−";
      else return;
    } else {
      var last = e.slice(-1);
      if (last === "(") {
        if (op === "−") e += "−";
        else return;
      } else if (last === ".") {
        return;
      } else if (isOp(last)) {
        if ((last === "×" || last === "÷") && op === "−") e += "−";
        else e = e.slice(0, -1) + op;
      } else {
        e += op;
      }
    }
    state.expr = e;
    render();
  }

  function inputParen() {
    startFresh();
    var e = state.expr;
    var last = e.slice(-1);
    var open = (e.match(/\(/g) || []).length;
    var close = (e.match(/\)/g) || []).length;

    if (open > close && (last === ")" || last === "%" || /\d/.test(last))) {
      e += ")";
    } else if (e === "" || isOp(last) || last === "(") {
      e += "(";
    } else {
      e += "×(";
    }
    state.expr = e;
    render();
  }

  function inputPercent() {
    continueFromResult();
    var e = state.expr;
    if (!trailingNumber(e) || e.slice(-1) === "%") return;
    state.expr = e + "%";
    render();
  }

  function inputSign() {
    continueFromResult();
    var e = state.expr;
    var m = e.match(/(\d+\.?\d*)$/);

    if (!m) {
      var last = e.slice(-1);
      if (e === "" || isOp(last) || last === "(") {
        if (last !== "−") e += "−";
        state.expr = e;
        render();
      }
      return;
    }

    var start = e.length - m[0].length;
    var before = e.slice(start - 1, start);
    var beforeBefore = e.slice(start - 2, start - 1);

    if (
      before === "−" &&
      (start - 1 === 0 ||
        isOp(beforeBefore) ||
        beforeBefore === "(" ||
        beforeBefore === "")
    ) {
      e = e.slice(0, start - 1) + m[0];
    } else {
      e = e.slice(0, start) + "−" + m[0];
    }
    state.expr = e;
    render();
  }

  function backspace() {
    if (state.error) {
      clearAll();
      return;
    }
    if (state.evaluated) {
      state.expr = "";
      state.evaluated = false;
      state.lastResult = null;
    } else {
      state.expr = state.expr.slice(0, -1);
    }
    render();
  }

  function equals() {
    if (state.error) {
      clearAll();
      return;
    }
    if (!state.expr) return;
    if (state.evaluated) return;

    var r = evaluate(state.expr);
    if (r.error) {
      state.error = true;
      render();
      return;
    }
    if (r.value === null) return;

    state.lastResult = r.value;
    state.evaluated = true;
    render();
  }

  function dispatch(action, value) {
    switch (action) {
      case "digit":
        inputDigit(value);
        break;
      case "dot":
        inputDot();
        break;
      case "op":
        inputOperator(value);
        break;
      case "paren":
        inputParen();
        break;
      case "percent":
        inputPercent();
        break;
      case "sign":
        inputSign();
        break;
      case "clear":
        clearAll();
        break;
      case "equals":
        equals();
        break;
    }
  }

  /* ---------- events ---------- */

  keysEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".key");
    if (!btn) return;
    buzz();
    dispatch(btn.dataset.action, btn.dataset.value);
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var k = ev.key;
    var action = null;
    var value;

    if (/^[0-9]$/.test(k)) {
      action = "digit";
      value = k;
    } else if (k === ".") {
      action = "dot";
    } else if (k === "+" || k === "-" || k === "*" || k === "/") {
      action = "op";
      value = k === "*" ? "×" : k === "/" ? "÷" : k === "-" ? "−" : "+";
    } else if (k === "%") {
      action = "percent";
    } else if (k === "(" || k === ")") {
      action = "paren";
    } else if (k === "Enter" || k === "=") {
      action = "equals";
    } else if (k === "Backspace") {
      action = "backspace";
    } else if (k === "Escape" || k === "Delete" || k === "c" || k === "C") {
      action = "clear";
    }

    if (!action) return;
    ev.preventDefault();

    if (action === "backspace") backspace();
    else dispatch(action, value);

    // Flash the matching physical key.
    var selector;
    if (action === "digit")
      selector = '.key[data-action="digit"][data-value="' + value + '"]';
    else if (action === "op")
      selector = '.key[data-action="op"][data-value="' + value + '"]';
    else selector = '.key[data-action="' + action + '"]';
    var btn = selector && keysEl.querySelector(selector);
    if (btn) {
      btn.classList.add("flash");
      setTimeout(function () {
        btn.classList.remove("flash");
      }, 110);
    }
  });

  render();
})();
