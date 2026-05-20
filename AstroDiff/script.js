/**
 * AstroDiff - First-Order Differential Equation Solver & Visualizer
 * Core logic including numerical solvers, symbolic math helpers, KaTeX rendering, and Canvas graphics.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();

    // Premium Simulation State
    let isPremium = false;
    let initialLoad = true;

    // DOM Elements
    const eqTypeSelect = document.getElementById('eq-type');
    const btnCalculate = document.getElementById('btn-calculate');
    
    // Paywall and Payment Elements
    const paywallModal = document.getElementById('paywall-modal');
    const paymentModal = document.getElementById('payment-modal');
    const paywallExpression = document.getElementById('paywall-expression');
    const btnClosePaywall = document.getElementById('btn-close-paywall');
    const btnClosePayment = document.getElementById('btn-close-payment');
    const planMonthly = document.getElementById('plan-monthly');
    const planYearly = document.getElementById('plan-yearly');
    const btnContinuePlan = document.getElementById('btn-continue-plan');
    const btnMaybeLater = document.getElementById('btn-maybe-later');
    const btnSubmitPayment = document.getElementById('btn-submit-payment');
    const btnSuccessClose = document.getElementById('btn-success-close');
    const logoBadge = document.querySelector('.badge');
    
    const paymentFormStep = document.getElementById('payment-form-step');
    const paymentProcessingStep = document.getElementById('payment-processing-step');
    const paymentSuccessStep = document.getElementById('payment-success-step');

    // Inputs Groups
    const inputsLinear = document.getElementById('inputs-linear');
    const inputsSeparable = document.getElementById('inputs-separable');
    const inputsGeneral = document.getElementById('inputs-general');
    
    // Formulas inputs
    const inputPx = document.getElementById('input-px');
    const inputQx = document.getElementById('input-qx');
    const inputFx = document.getElementById('input-fx');
    const inputGy = document.getElementById('input-gy');
    const inputFxy = document.getElementById('input-fxy');
    
    // Initial Conditions
    const inputX0 = document.getElementById('input-x0');
    const inputY0 = document.getElementById('input-y0');
    const toggleIC = document.getElementById('toggle-ic');
    
    // Canvas & Controls
    const canvas = document.getElementById('slope-field-canvas');
    const ctx = canvas.getContext('2d');
    const coordsDisplay = document.getElementById('coords-display');
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnResetView = document.getElementById('btn-reset-view');
    const btnClearPoints = document.getElementById('btn-clear-points');
    
    // Outputs
    const solutionContainer = document.getElementById('solution-container');
    const numericalTableBody = document.querySelector('#numerical-table tbody');
    const inputStepH = document.getElementById('input-step-h');
    const inputStepsCount = document.getElementById('input-steps-count');

    // LaTeX Previews
    const linearPreview = document.getElementById('linear-latex-preview');
    const separablePreview = document.getElementById('separable-latex-preview');
    const generalPreview = document.getElementById('general-latex-preview');

    // State Variables for Visualizer Canvas
    let xMin = -5;
    let xMax = 5;
    let yMin = -5;
    let yMax = 5;
    const defaultBounds = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
    
    let activePlotPoints = []; // Clicked initial conditions curves to redraw
    let currentParsedFunction = null; // Compiled Math.js function for y' = f(x,y)
    
    // Formula to evaluate for the general slope field
    let currentODEType = 'linear'; // 'linear', 'separable', 'general'

    // ==========================================================================
    // Math Utilities & Symbolic Integrator
    // ==========================================================================

    // Simple parser to integrate simple terms symbolically.
    // For engineering homework: ax^n, e^{ax}, sin(ax), cos(ax), 1/x
    function integrateTermSymbolic(termStr, variable = 'x') {
        const str = termStr.trim().replace(/\s+/g, '');
        if (!str) return { latex: '0', expr: '0' };

        // Matches constants (e.g. 5, -3.2, 1/2)
        if (/^-?\d+(\.\d+)?(\/\d+)?$/.test(str)) {
            const val = str;
            if (val === '0') return { latex: '0', expr: '0' };
            const latexVal = val === '1' ? '' : val === '-1' ? '-' : val;
            return { latex: `${latexVal}${variable}`, expr: `${val}*${variable}` };
        }

        // Matches power of x: k*x^n or k*x or x^n or x
        // RegEx to capture: group 1: coeff, group 2: x, group 3: exponent
        const powerRegex = /^([+-]?\d*(?:\.\d+)?(?:\/\d+)?)?\*?([xX])(?:\^([+-]?\d+))?$/;
        const matchPower = str.match(powerRegex);
        if (matchPower) {
            let coeffStr = matchPower[1] || '';
            if (coeffStr === '+' || coeffStr === '') coeffStr = '1';
            if (coeffStr === '-') coeffStr = '-1';
            
            const coeff = eval(coeffStr);
            const exp = matchPower[3] ? parseInt(matchPower[3], 10) : 1;

            if (exp === -1) {
                // Integral of 1/x is ln(|x|)
                const coeffLatex = coeff === 1 ? '' : coeff === -1 ? '-' : coeffStr;
                return { 
                    latex: `${coeffLatex} \\ln|${variable}|`, 
                    expr: `${coeff}*log(abs(${variable}))` 
                };
            } else {
                const newExp = exp + 1;
                const newCoeff = coeff / newExp;
                const coeffLatex = formatFractionLatex(coeff, newExp);
                const expLatex = newExp === 1 ? '' : `^{${newExp}}`;
                
                return {
                    latex: `${coeffLatex}${variable}${expLatex}`,
                    expr: `(${coeff}/${newExp})*${variable}^${newExp}`
                };
            }
        }

        // Matches a/x or k*(1/x)
        const divRegex = /^([+-]?\d+(?:\.\d+)?(?:\/\d+)?)\/([xX])$/;
        const matchDiv = str.match(divRegex);
        if (matchDiv) {
            const coeffStr = matchDiv[1];
            return {
                latex: `${coeffStr} \\ln|${variable}|`,
                expr: `${coeffStr}*log(abs(${variable}))`
            };
        }

        // Matches e^(ax) or exp(ax)
        const expRegex = /^([+-]?\d*(?:\.\d+)?(?:\/\d+)?)?\*?(?:exp|e\^)\(([+-]?\d*(?:\.\d+)?(?:\/\d+)?)?\*?([xX])\)$/;
        const matchExp = str.match(expRegex);
        if (matchExp) {
            let coeffOuter = matchExp[1] || '';
            if (coeffOuter === '+' || coeffOuter === '') coeffOuter = '1';
            if (coeffOuter === '-') coeffOuter = '-1';

            let coeffInner = matchExp[2] || '';
            if (coeffInner === '+' || coeffInner === '') coeffInner = '1';
            if (coeffInner === '-') coeffInner = '-1';

            const outer = eval(coeffOuter);
            const inner = eval(coeffInner);

            const resultCoeff = outer / inner;
            const coeffLatex = formatFractionLatex(outer, inner);

            return {
                latex: `${coeffLatex} e^{${inner === 1 ? '' : inner === -1 ? '-' : inner}${variable}}`,
                expr: `(${outer}/${inner})*exp(${inner}*${variable})`
            };
        }

        // Matches sin(ax)
        const sinRegex = /^([+-]?\d*(?:\.\d+)?(?:\/\d+)?)?\*?sin\(([+-]?\d*(?:\.\d+)?(?:\/\d+)?)?\*?([xX])\)$/;
        const matchSin = str.match(sinRegex);
        if (matchSin) {
            let coeffOuter = matchSin[1] || '';
            if (coeffOuter === '+' || coeffOuter === '') coeffOuter = '1';
            if (coeffOuter === '-') coeffOuter = '-1';

            let coeffInner = matchSin[2] || '';
            if (coeffInner === '+' || coeffInner === '') coeffInner = '1';
            if (coeffInner === '-') coeffInner = '-1';

            const outer = eval(coeffOuter);
            const inner = eval(coeffInner);

            // Integral of sin(ax) is -cos(ax)/a
            const resultCoeff = -outer / inner;
            const coeffLatex = formatFractionLatex(-outer, inner);

            return {
                latex: `${coeffLatex} \\cos(${inner === 1 ? '' : inner === -1 ? '-' : inner}${variable})`,
                expr: `(${-outer}/${inner})*cos(${inner}*${variable})`
            };
        }

        // Matches cos(ax)
        const cosRegex = /^([+-]?\d*(?:\.\d+)?(?:\/\d+)?)?\*?cos\(([+-]?\d*(?:\.\d+)?(?:\/\d+)?)?\*?([xX])\)$/;
        const matchCos = str.match(cosRegex);
        if (matchCos) {
            let coeffOuter = matchCos[1] || '';
            if (coeffOuter === '+' || coeffOuter === '') coeffOuter = '1';
            if (coeffOuter === '-') coeffOuter = '-1';

            let coeffInner = matchCos[2] || '';
            if (coeffInner === '+' || coeffInner === '') coeffInner = '1';
            if (coeffInner === '-') coeffInner = '-1';

            const outer = eval(coeffOuter);
            const inner = eval(coeffInner);

            // Integral of cos(ax) is sin(ax)/a
            const resultCoeff = outer / inner;
            const coeffLatex = formatFractionLatex(outer, inner);

            return {
                latex: `${coeffLatex} \\sin(${inner === 1 ? '' : inner === -1 ? '-' : inner}${variable})`,
                expr: `(${outer}/${inner})*sin(${inner}*${variable})`
            };
        }

        // Fallback for unrecognized forms
        return null;
    }

    // Formats a float coefficient as a clean LaTeX fraction or integer
    function formatFractionLatex(num, denom) {
        const val = num / denom;
        if (Number.isInteger(val)) {
            if (val === 1) return '';
            if (val === -1) return '-';
            return val.toString();
        }
        
        // Find greatest common divisor
        const gcd = (a, b) => b ? gcd(b, a % b) : a;
        // Convert to absolute integer components for display
        let n = Math.round(num * 10000);
        let d = Math.round(denom * 10000);
        const divisor = Math.abs(gcd(n, d));
        n = n / divisor;
        d = d / divisor;

        const sign = (n * d < 0) ? '-' : '';
        return `${sign}\\frac{${Math.abs(n)}}{${Math.abs(d)}}`;
    }

    // Symbolic Integrator for sums of simple terms
    function integrateSymbolic(exprString, variable = 'x') {
        // Clean expressions: add signs before variables if needed, split by + or - (preserving sign)
        let cleaned = exprString.trim().replace(/\s+/g, '');
        
        // Insert placeholders to split by addition/subtraction
        cleaned = cleaned.replace(/([+-])/g, ' $1');
        const terms = cleaned.split(' ').filter(t => t.length > 0);
        
        let integratedLatexParts = [];
        let integratedExprParts = [];
        let failed = false;

        for (let term of terms) {
            let sign = '';
            if (term.startsWith('+')) {
                term = term.substring(1);
            } else if (term.startsWith('-')) {
                sign = '-';
                term = term.substring(1);
            }
            
            const res = integrateTermSymbolic(term, variable);
            if (res === null) {
                failed = true;
                break;
            }

            let latexPart = res.latex;
            let exprPart = res.expr;

            if (sign === '-') {
                // Prepend minus to latex part correctly
                if (latexPart.startsWith('-')) {
                    latexPart = '+' + latexPart.substring(1);
                } else if (latexPart.startsWith('+')) {
                    latexPart = '-' + latexPart.substring(1);
                } else {
                    latexPart = '-' + latexPart;
                }
                
                exprPart = `-(${exprPart})`;
            } else {
                if (integratedLatexParts.length > 0 && !latexPart.startsWith('-') && !latexPart.startsWith('+')) {
                    latexPart = '+' + latexPart;
                }
            }

            integratedLatexParts.push(latexPart);
            integratedExprParts.push(exprPart);
        }

        if (failed) return null;

        return {
            latex: integratedLatexParts.join(' ').replace(/\+ -/g, '-').replace(/\+\+/g, '+'),
            expr: integratedExprParts.join('+').replace(/\+-/g, '-')
        };
    }

    // Utility to get LaTeX expression from typical user math string
    function toLatex(exprString) {
        try {
            return math.parse(exprString).toTex();
        } catch (e) {
            return exprString; // Fallback
        }
    }

    // Evaluates a compiled function safely, catching division by zero etc
    function safeEvaluate(compiledExpr, scope) {
        try {
            const val = compiledExpr.evaluate(scope);
            if (isNaN(val) || !isFinite(val)) return null;
            return val;
        } catch (e) {
            return null;
        }
    }

    // ==========================================================================
    // UI Setup & Dynamics
    // ==========================================================================

    function updateInputsVisibility() {
        currentODEType = eqTypeSelect.value;
        
        inputsLinear.classList.remove('active');
        inputsSeparable.classList.remove('active');
        inputsGeneral.classList.remove('active');

        if (currentODEType === 'linear') {
            inputsLinear.classList.add('active');
        } else if (currentODEType === 'separable') {
            inputsSeparable.classList.add('active');
        } else {
            inputsGeneral.classList.add('active');
        }
        
        updatePreviews();
    }

    function updatePreviews() {
        try {
            if (currentODEType === 'linear') {
                const pxLatex = toLatex(inputPx.value || 'P(x)');
                const qxLatex = toLatex(inputQx.value || 'Q(x)');
                katex.render(`y' + (${pxLatex})y = ${qxLatex}`, linearPreview, { throwOnError: false });
            } else if (currentODEType === 'separable') {
                const fxLatex = toLatex(inputFx.value || 'f(x)');
                const gyLatex = toLatex(inputGy.value || 'g(y)');
                katex.render(`y' = (${fxLatex}) \\cdot (${gyLatex})`, separablePreview, { throwOnError: false });
            } else if (currentODEType === 'general') {
                const fxyLatex = toLatex(inputFxy.value || 'f(x,y)');
                katex.render(`y' = ${fxyLatex}`, generalPreview, { throwOnError: false });
            }
        } catch (err) {
            // Ignore temporary parser errors during typing
        }
    }

    // Live update of LaTeX previews while typing
    [inputPx, inputQx, inputFx, inputGy, inputFxy].forEach(inp => {
        inp.addEventListener('input', updatePreviews);
    });
    
    eqTypeSelect.addEventListener('change', updateInputsVisibility);
    updateInputsVisibility();

    // ==========================================================================
    // Numerical ODE Solver (RK4 & Euler algorithms)
    // ==========================================================================

    // Solves y' = f(x,y) from x0 to targetX using RK4
    function solveRK4(fVal, x0, y0, targetX, h = 0.05) {
        let x = x0;
        let y = y0;
        const points = [{x, y}];
        
        const isForward = targetX >= x0;
        const step = isForward ? Math.abs(h) : -Math.abs(h);
        
        const maxSteps = 1000; // Guard against infinite loops
        let stepCount = 0;

        while (isForward ? (x < targetX) : (x > targetX)) {
            if (stepCount++ > maxSteps) break;
            
            // Adjust step if we would overshoot
            let currentStep = step;
            if (isForward && (x + step > targetX)) {
                currentStep = targetX - x;
            } else if (!isForward && (x + step < targetX)) {
                currentStep = targetX - x;
            }

            const k1 = fVal(x, y);
            if (k1 === null) break;
            
            const k2 = fVal(x + currentStep/2, y + currentStep*k1/2);
            if (k2 === null) break;
            
            const k3 = fVal(x + currentStep/2, y + currentStep*k2/2);
            if (k3 === null) break;
            
            const k4 = fVal(x + currentStep, y + currentStep*k3);
            if (k4 === null) break;

            y = y + (currentStep/6) * (k1 + 2*k2 + 2*k3 + k4);
            x = x + currentStep;

            if (isNaN(y) || !isFinite(y)) break;
            points.push({x, y});
        }
        
        return points;
    }

    // Generate RK4 and Euler comparison tables for educational purposes
    function generateComparisonData(fVal, x0, y0, h, stepsCount) {
        let eulerX = x0;
        let eulerY = y0;
        
        let rk4X = x0;
        let rk4Y = y0;
        
        const comparison = [{
            step: 0,
            x: x0,
            yEuler: y0,
            yRK4: y0,
            diff: 0
        }];

        for (let i = 1; i <= stepsCount; i++) {
            // Calculate Euler step
            const eulerSlope = fVal(eulerX, eulerY);
            let nextEulerY = null;
            if (eulerSlope !== null) {
                nextEulerY = eulerY + h * eulerSlope;
                eulerY = nextEulerY;
                eulerX += h;
            } else {
                eulerY = NaN;
                eulerX += h;
            }

            // Calculate RK4 step
            const k1 = fVal(rk4X, rk4Y);
            let nextRK4Y = null;
            if (k1 !== null) {
                const k2 = fVal(rk4X + h/2, rk4Y + h*k1/2);
                const k3 = fVal(rk4X + h/2, rk4Y + h*k2/2);
                const k4 = fVal(rk4X + h, rk4Y + h*k3);
                
                if (k2 !== null && k3 !== null && k4 !== null) {
                    nextRK4Y = rk4Y + (h/6) * (k1 + 2*k2 + 2*k3 + k4);
                    rk4Y = nextRK4Y;
                    rk4X += h;
                } else {
                    rk4Y = NaN;
                    rk4X += h;
                }
            } else {
                rk4Y = NaN;
                rk4X += h;
            }

            const diff = (isNaN(rk4Y) || isNaN(eulerY)) ? null : Math.abs(rk4Y - eulerY);

            comparison.push({
                step: i,
                x: rk4X,
                yEuler: isNaN(eulerY) ? null : eulerY,
                yRK4: isNaN(rk4Y) ? null : rk4Y,
                diff: diff
            });
        }

        return comparison;
    }

    // Compile inputs to a single function y' = f(x, y) depending on EDO type
    function compileODEFunction() {
        try {
            if (currentODEType === 'linear') {
                const pxExpr = math.compile(inputPx.value || '0');
                const qxExpr = math.compile(inputQx.value || '0');
                return (x, y) => {
                    const p = safeEvaluate(pxExpr, { x });
                    const q = safeEvaluate(qxExpr, { x });
                    if (p === null || q === null) return null;
                    return q - p * y; // y' = Q(x) - P(x)*y
                };
            } else if (currentODEType === 'separable') {
                const fxExpr = math.compile(inputFx.value || '0');
                const gyExpr = math.compile(inputGy.value || '1');
                return (x, y) => {
                    const f = safeEvaluate(fxExpr, { x });
                    const g = safeEvaluate(gyExpr, { y });
                    if (f === null || g === null) return null;
                    return f * g; // y' = f(x)*g(y)
                };
            } else {
                // General
                const fxyExpr = math.compile(inputFxy.value || '0');
                return (x, y) => {
                    return safeEvaluate(fxyExpr, { x, y });
                };
            }
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    // ==========================================================================
    // Canvas Slope Field Visualizer Graphics
    // ==========================================================================

    function setupCanvas() {
        // High DPI Canvas display correction
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        ctx.scale(dpr, dpr);
        drawSlopeField();
    }

    window.addEventListener('resize', setupCanvas);

    // Map mathematical coordinates to canvas pixel coordinates
    function toCanvasCoords(x, y) {
        const rect = canvas.getBoundingClientRect();
        const px = ((x - xMin) / (xMax - xMin)) * rect.width;
        const py = rect.height - (((y - yMin) / (yMax - yMin)) * rect.height); // Flip y for standard cartesian grid
        return { x: px, y: py };
    }

    // Map canvas pixel coordinates to mathematical coordinates
    function toMathCoords(px, py) {
        const rect = canvas.getBoundingClientRect();
        const x = xMin + (px / rect.width) * (xMax - xMin);
        const y = yMin + ((rect.height - py) / rect.height) * (yMax - yMin);
        return { x, y };
    }

    // Draw the entire visualizer: Grid, Slope arrows, Solutions curves, Initial Condition points
    function drawSlopeField() {
        if (!canvas.width || !canvas.height) return;
        
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        const xStep = (xMax - xMin) / 10;
        const yStep = (yMax - yMin) / 10;
        
        // Vertical lines
        for (let x = xMin; x <= xMax; x += xStep) {
            const p = toCanvasCoords(x, 0);
            ctx.beginPath();
            ctx.moveTo(p.x, 0);
            ctx.lineTo(p.x, rect.height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = yMin; y <= yMax; y += yStep) {
            const p = toCanvasCoords(0, y);
            ctx.beginPath();
            ctx.moveTo(0, p.y);
            ctx.lineTo(rect.width, p.y);
            ctx.stroke();
        }

        // Draw Axes (x=0 and y=0)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        
        const origin = toCanvasCoords(0, 0);
        
        // X-Axis
        if (origin.y >= 0 && origin.y <= rect.height) {
            ctx.beginPath();
            ctx.moveTo(0, origin.y);
            ctx.lineTo(rect.width, origin.y);
            ctx.stroke();
            
            // Numbers on X Axis
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '10px Plus Jakarta Sans';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            for (let x = xMin; x <= xMax; x += xStep) {
                if (Math.abs(x) < 0.001) continue; // Skip origin text
                const p = toCanvasCoords(x, 0);
                ctx.fillText(x.toFixed(1), p.x, origin.y + 4);
            }
        }
        
        // Y-Axis
        if (origin.x >= 0 && origin.x <= rect.width) {
            ctx.beginPath();
            ctx.moveTo(origin.x, 0);
            ctx.lineTo(origin.x, rect.height);
            ctx.stroke();
            
            // Numbers on Y Axis
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '10px Plus Jakarta Sans';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            for (let y = yMin; y <= yMax; y += yStep) {
                if (Math.abs(y) < 0.001) continue;
                const p = toCanvasCoords(0, y);
                ctx.fillText(y.toFixed(1), origin.x - 6, p.y);
            }
        }

        // Label Origin "0"
        if (origin.x >= 0 && origin.x <= rect.width && origin.y >= 0 && origin.y <= rect.height) {
            ctx.fillText("0", origin.x - 6, origin.y + 4);
        }

        // Draw Slope Field Arrows
        if (currentParsedFunction) {
            const densityX = 22; // columns
            const densityY = 16; // rows
            
            for (let i = 0; i < densityX; i++) {
                const x = xMin + (i + 0.5) * (xMax - xMin) / densityX;
                for (let j = 0; j < densityY; j++) {
                    const y = yMin + (j + 0.5) * (yMax - yMin) / densityY;
                    
                    const slope = currentParsedFunction(x, y);
                    if (slope === null || isNaN(slope)) continue;
                    
                    // Draw short arrow/segment centered at (x, y)
                    const angle = Math.atan(slope);
                    const length = 15; // length of arrow in pixels
                    
                    const center = toCanvasCoords(x, y);
                    const dx = Math.cos(angle) * length / 2;
                    const dy = -Math.sin(angle) * length / 2; // Negate dy for canvas space coords
                    
                    // Color code slopes by steepness: steep -> purple/pink, gentle -> blue/cyan
                    const absSlope = Math.abs(slope);
                    const normalizedSteepness = Math.min(absSlope / 3, 1); // Clamp
                    
                    // Interpolate between cyan (0,229,255) and neon purple (213,0,249)
                    const r = Math.round(0 + normalizedSteepness * 213);
                    const g = Math.round(229 * (1 - normalizedSteepness));
                    const b = Math.round(255 * (1 - normalizedSteepness) + 249 * normalizedSteepness);
                    const alpha = 0.35 + (1 - normalizedSteepness) * 0.15; // steeper is slightly more transparent/faded
                    
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(center.x - dx, center.y - dy);
                    ctx.lineTo(center.x + dx, center.y + dy);
                    ctx.stroke();
                }
            }
        }

        // Redraw solution curves
        activePlotPoints.forEach(ic => {
            drawParticularSolution(ic.x, ic.y, ic.isPrimary);
        });
    }

    // Trazar la curva de solución particular por RK4
    function drawParticularSolution(x0, y0, isPrimary = false) {
        if (!currentParsedFunction) return;

        // Compute forward and backward RK4 points across canvas width
        const pointsForward = solveRK4(currentParsedFunction, x0, y0, xMax, 0.05);
        const pointsBackward = solveRK4(currentParsedFunction, x0, y0, xMin, 0.05);
        
        // Merge trajectories
        const fullTrajectory = [...pointsBackward.reverse(), ...pointsForward.slice(1)];
        
        if (fullTrajectory.length < 2) return;

        // Draw trajectory
        ctx.beginPath();
        let first = true;
        for (const pt of fullTrajectory) {
            const p = toCanvasCoords(pt.x, pt.y);
            // Don't draw if outside vertical screen bounds excessively to avoid wild graphics
            if (pt.y < yMin - 10 || pt.y > yMax + 10) {
                first = true;
                continue;
            }
            if (first) {
                ctx.moveTo(p.x, p.y);
                first = false;
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        
        ctx.lineWidth = isPrimary ? 3.5 : 2;
        ctx.strokeStyle = isPrimary ? 'var(--accent-cyan)' : 'rgba(0, 229, 255, 0.5)';
        if (isPrimary) {
            ctx.shadowColor = 'rgba(0, 225, 255, 0.4)';
            ctx.shadowBlur = 8;
        }
        ctx.stroke();
        
        // Reset shadows
        ctx.shadowBlur = 0;

        // Draw Initial Condition Point
        const icPixel = toCanvasCoords(x0, y0);
        ctx.beginPath();
        ctx.arc(icPixel.x, icPixel.y, isPrimary ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isPrimary ? 'var(--accent-gold)' : 'rgba(255, 215, 64, 0.7)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Canvas interactivity
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const mathPt = toMathCoords(px, py);
        coordsDisplay.textContent = `x: ${mathPt.x.toFixed(2)}, y: ${mathPt.y.toFixed(2)}`;
    });

    canvas.addEventListener('click', (e) => {
        if (!isPremium) {
            showPaywall();
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const mathPt = toMathCoords(px, py);
        
        // Set coordinates in initial condition inputs
        inputX0.value = mathPt.x.toFixed(3);
        inputY0.value = mathPt.y.toFixed(3);
        toggleIC.checked = true;

        // Add this new trajectory to canvas list
        // Limit custom plots to 5 to avoid overloading
        if (activePlotPoints.length >= 6) {
            activePlotPoints.shift(); // Remove oldest
        }
        
        // Set all previous as non-primary
        activePlotPoints.forEach(p => p.isPrimary = false);
        
        // Add new as primary
        activePlotPoints.push({
            x: mathPt.x,
            y: mathPt.y,
            isPrimary: true
        });

        // Trigger calculation updates to match this click!
        calculateAndDisplay(false); // don't clear the custom trajectories
    });

    // Zoom and Navigation Canvas Actions
    btnZoomIn.addEventListener('click', () => {
        const xRange = xMax - xMin;
        const yRange = yMax - yMin;
        xMin += xRange * 0.15;
        xMax -= xRange * 0.15;
        yMin += yRange * 0.15;
        yMax -= yRange * 0.15;
        drawSlopeField();
    });

    btnZoomOut.addEventListener('click', () => {
        const xRange = xMax - xMin;
        const yRange = yMax - yMin;
        xMin -= xRange * 0.15;
        xMax += xRange * 0.15;
        yMin -= yRange * 0.15;
        yMax += yRange * 0.15;
        drawSlopeField();
    });

    btnResetView.addEventListener('click', () => {
        xMin = defaultBounds.xMin;
        xMax = defaultBounds.xMax;
        yMin = defaultBounds.yMin;
        yMax = defaultBounds.yMax;
        drawSlopeField();
    });

    btnClearPoints.addEventListener('click', () => {
        activePlotPoints = [];
        drawSlopeField();
    });

    // ==========================================================================
    // Solver Logic: Analytical & Step-by-step display
    // ==========================================================================

    function calculateAndDisplay(clearPlots = true) {
        if (!isPremium && !initialLoad) {
            showPaywall();
            return;
        }
        currentParsedFunction = compileODEFunction();
        if (!currentParsedFunction) {
            alert("Error: Por favor, introduce una ecuación válida. Verifica la sintaxis.");
            return;
        }

        const useIC = toggleIC.checked;
        const x0 = parseFloat(inputX0.value) || 0;
        const y0 = parseFloat(inputY0.value) || 0;

        if (clearPlots) {
            activePlotPoints = [];
            if (useIC) {
                activePlotPoints.push({ x: x0, y: y0, isPrimary: true });
            }
        }

        // Draw visual graphics
        drawSlopeField();

        // 1. Generate step-by-step mathematical HTML
        generateAnalyticalSteps(x0, y0, useIC);

        // 2. Generate Numerical Table
        generateNumericalTable(x0, y0, useIC);
    }

    btnCalculate.addEventListener('click', () => calculateAndDisplay(true));

    function generateNumericalTable(x0, y0, useIC) {
        numericalTableBody.innerHTML = '';

        if (!useIC) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="5" class="empty-table-msg">Activa las condiciones iniciales para ver la simulación numérica.</td>`;
            numericalTableBody.appendChild(tr);
            return;
        }

        const h = parseFloat(inputStepH.value) || 0.1;
        const steps = parseInt(inputStepsCount.value, 10) || 10;
        
        const data = generateComparisonData(currentParsedFunction, x0, y0, h, steps);

        data.forEach(row => {
            const tr = document.createElement('tr');
            
            const yEulerStr = row.yEuler !== null ? row.yEuler.toFixed(5) : 'N/A';
            const yRK4Str = row.yRK4 !== null ? row.yRK4.toFixed(5) : 'N/A';
            const diffStr = row.diff !== null ? row.diff.toExponential(4) : 'N/A';

            tr.innerHTML = `
                <td>${row.step}</td>
                <td>${row.x.toFixed(4)}</td>
                <td>${yEulerStr}</td>
                <td>${yRK4Str}</td>
                <td>${diffStr}</td>
            `;
            numericalTableBody.appendChild(tr);
        });
    }

    // Builds the structured latex output steps
    function generateAnalyticalSteps(x0, y0, useIC) {
        solutionContainer.innerHTML = '';
        
        if (currentODEType === 'linear') {
            solveLinearStepByStep(x0, y0, useIC);
        } else if (currentODEType === 'separable') {
            solveSeparableStepByStep(x0, y0, useIC);
        } else {
            solveGeneralStepByStep();
        }
    }

    // STEP BY STEP: LINEAR EDO y' + P(x)y = Q(x)
    function solveLinearStepByStep(x0, y0, useIC) {
        const pxStr = inputPx.value || '0';
        const qxStr = inputQx.value || '0';
        
        const pxLatex = toLatex(pxStr);
        const qxLatex = toLatex(qxStr);
        
        // Step 1: Identification
        let html = `
            <div class="solution-step">
                <h3>Paso 1: Identificar las funciones P(x) y Q(x)</h3>
                <p>La ecuación diferencial está escrita en su forma estándar:</p>
                <div class="solution-step-formula">$$y' + P(x)y = Q(x)$$</div>
                <p>Donde identificamos:</p>
                <div class="solution-step-formula">$$P(x) = ${pxLatex}, \\quad Q(x) = ${qxLatex}$$</div>
            </div>
        `;

        // Step 2: Integrating Factor μ(x) = e^( ∫ P(x) dx )
        const pIntResult = integrateSymbolic(pxStr, 'x');
        let muLatex = '';
        let muExpr = '';
        let step2Formula = '';

        if (pIntResult) {
            muExpr = `exp(${pIntResult.expr})`;
            muLatex = `e^{${pIntResult.latex}}`;
            step2Formula = `$$\\mu(x) = e^{\\int (${pxLatex}) dx} = e^{${pIntResult.latex}}$$`;
        } else {
            muExpr = `exp(integral(${pxStr}, x))`;
            muLatex = `e^{\\int (${pxLatex}) dx}`;
            step2Formula = `$$\\mu(x) = e^{\\int P(x)dx} = e^{\\int (${pxLatex}) dx}$$`;
        }

        html += `
            <div class="solution-step">
                <h3>Paso 2: Calcular el Factor Integrante $\\mu(x)$</h3>
                <p>El factor integrante se define como $\\mu(x) = e^{\\int P(x) dx}$:</p>
                <div class="solution-step-formula">${step2Formula}</div>
            </div>
        `;

        // Step 3: Set up standard solution formula
        html += `
            <div class="solution-step">
                <h3>Paso 3: Aplicar la fórmula general de solución</h3>
                <p>La solución general para una ecuación lineal de primer orden está dada por:</p>
                <div class="solution-step-formula">$$y(x) = \\frac{1}{\\mu(x)} \\left[ \\int \\mu(x) \\cdot Q(x) \\, dx + C \\right]$$</div>
                <p>Sustituyendo $\\mu(x)$ y $Q(x)$ en la fórmula:</p>
                <div class="solution-step-formula">$$y(x) = \\frac{1}{${muLatex}} \\left[ \\int (${muLatex}) \\cdot (${qxLatex}) \\, dx + C \\right]$$</div>
            </div>
        `;

        // Step 4: Integrate μ(x)*Q(x)
        // Let's check if we can integrate it symbolically
        let solvedGeneral = false;
        let finalGeneralLatex = '';
        let integralProductStr = '';
        
        // Attempt integration of mu(x)*q(x).
        // For simple cases like q(x)=0 (homogeneous)
        if (qxStr.trim() === '0') {
            finalGeneralLatex = `y(x) = \\frac{C}{${muLatex}}`;
            solvedGeneral = true;
            html += `
                <div class="solution-step">
                    <h3>Paso 4: Resolver la Integral (Caso Homogéneo)</h3>
                    <p>Dado que $Q(x) = 0$, la integral del producto es cero:</p>
                    <div class="solution-step-formula">$$\\int \\mu(x)Q(x)\\,dx = \\int 0\\,dx = 0$$</div>
                    <p>Por lo tanto, la solución general es:</p>
                    <div class="solution-step-formula">$$y(x) = \\frac{C}{${muLatex}}$$</div>
                </div>
            `;
        } else {
            // Check if we can solve the product symbolically. Let's try combining expressions
            let integratedProduct = null;
            
            // Try matching common homework equations:
            // 1. y' + 2y = x  => P=2, Q=x. mu = e^2x, Q = x. Integral x*e^2x dx.
            // Let's write a small rule-based solver for standard products:
            if (pxStr.trim() === '1' && qxStr.trim() === 'x') {
                // mu = e^x, q = x. Integral x e^x dx = (x-1)e^x
                integratedProduct = { latex: '(x - 1)e^{x}', expr: '(x-1)*exp(x)' };
            } else if (pxStr.trim() === '2' && qxStr.trim() === 'x') {
                // mu = e^2x, q = x. Integral x e^2x dx = (x/2 - 1/4)e^2x
                integratedProduct = { latex: '\\left(\\frac{x}{2} - \\frac{1}{4}\\right)e^{2x}', expr: '(x/2 - 1/4)*exp(2*x)' };
            } else if (pxStr.trim() === '-2' && qxStr.trim() === 'x') {
                // mu = e^-2x, q = x. Integral x e^-2x = (-x/2 - 1/4)e^-2x
                integratedProduct = { latex: '\\left(-\\frac{x}{2} - \\frac{1}{4}\\right)e^{-2x}', expr: '(-x/2 - 1/4)*exp(-2*x)' };
            } else if (pxStr.trim() === '1/x' && qxStr.trim() === 'x') {
                // P=1/x, Q=x. mu = x, Q = x. Integral x*x = x^3/3
                integratedProduct = { latex: '\\frac{x^3}{3}', expr: '(x^3)/3' };
            } else if (pxStr.trim() === '1/x' && qxStr.trim() === '1') {
                // P=1/x, Q=1. mu = x, Q = 1. Integral x dx = x^2/2
                integratedProduct = { latex: '\\frac{x^2}{2}', expr: '(x^2)/2' };
            }

            if (integratedProduct) {
                solvedGeneral = true;
                // y(x) = 1/mu * (Int + C)
                // e.g. for P=2, Q=x: e^-2x * ((x/2 - 1/4)e^2x + C) = x/2 - 1/4 + C e^-2x
                // Let's format the general solution latex:
                if (pxStr.trim() === '1' && qxStr.trim() === 'x') {
                    finalGeneralLatex = `y(x) = x - 1 + C e^{-x}`;
                } else if (pxStr.trim() === '2' && qxStr.trim() === 'x') {
                    finalGeneralLatex = `y(x) = \\frac{x}{2} - \\frac{1}{4} + C e^{-2x}`;
                } else if (pxStr.trim() === '-2' && qxStr.trim() === 'x') {
                    finalGeneralLatex = `y(x) = -\\frac{x}{2} - \\frac{1}{4} + C e^{2x}`;
                } else if (pxStr.trim() === '1/x' && qxStr.trim() === 'x') {
                    finalGeneralLatex = `y(x) = \\frac{x^2}{3} + \\frac{C}{x}`;
                } else if (pxStr.trim() === '1/x' && qxStr.trim() === '1') {
                    finalGeneralLatex = `y(x) = \\frac{x}{2} + \\frac{C}{x}`;
                }

                html += `
                    <div class="solution-step">
                        <h3>Paso 4: Resolver la Integral del Producto</h3>
                        <p>Resolvemos la integral $\\int \\mu(x)Q(x)\\,dx$:</p>
                        <div class="solution-step-formula">$$\\int (${muLatex}) \\cdot (${qxLatex}) \\, dx = ${integratedProduct.latex}$$</div>
                        <p>Sustituyendo esto en la ecuación general, obtenemos la solución general explícita:</p>
                        <div class="solution-step-formula">$$${finalGeneralLatex}$$</div>
                    </div>
                `;
            } else {
                // If integration is too complex for basic parser:
                html += `
                    <div class="solution-step">
                        <h3>Paso 4: Resolver la Integral del Producto</h3>
                        <p>La integral de la solución general no posee una forma elemental directa o es compleja de simplificar algebraicamente:</p>
                        <div class="solution-step-formula">$$\\int (${muLatex}) \\cdot (${qxLatex}) \\, dx$$</div>
                        <div class="alert-note">
                            <strong>Nota:</strong> AstroDiff mostrará la solución general en forma de cuadración integral y trazará la solución exacta numéricamente en el gráfico superior.
                        </div>
                        <p>Solución general implícita:</p>
                        <div class="solution-step-formula">$$y(x) = \\frac{1}{${muLatex}} \\left[ \\int (${muLatex}) \\cdot (${qxLatex}) \\, dx + C \\right]$$</div>
                    </div>
                `;
            }
        }

        // Step 5: Solve for Initial Conditions
        if (useIC) {
            let solvedC = false;
            let cValueStr = '';
            let particularLatex = '';

            // Compute C numerically
            // y0 = 1/mu(x0) * (Integral(x0) + C) => C = y0 * mu(x0) - Integral(x0)
            // For known algebraic integrations:
            if (qxStr.trim() === '0') {
                // y = C/mu => C = y0 * mu(x0)
                try {
                    const muVal = math.evaluate(muExpr, { x: x0 });
                    const cVal = y0 * muVal;
                    cValueStr = cVal.toFixed(4);
                    particularLatex = `y(x) = \\frac{${cValueStr}}{${muLatex}}`;
                    solvedC = true;
                } catch(e) {}
            } else if (pxStr.trim() === '1' && qxStr.trim() === 'x') {
                // y = x - 1 + C e^-x => C = (y0 - x0 + 1) / e^-x0 = (y0 - x0 + 1)*e^x0
                const cVal = (y0 - x0 + 1) * Math.exp(x0);
                cValueStr = cVal.toFixed(4);
                particularLatex = `y(x) = x - 1 + (${cValueStr}) e^{-x}`;
                solvedC = true;
            } else if (pxStr.trim() === '2' && qxStr.trim() === 'x') {
                // y = x/2 - 1/4 + C e^-2x => C = (y0 - x0/2 + 1/4) * e^2x0
                const cVal = (y0 - x0/2 + 0.25) * Math.exp(2*x0);
                cValueStr = cVal.toFixed(4);
                particularLatex = `y(x) = \\frac{x}{2} - 0.25 + (${cValueStr}) e^{-2x}`;
                solvedC = true;
            } else if (pxStr.trim() === '-2' && qxStr.trim() === 'x') {
                // y = -x/2 - 1/4 + C e^2x => C = (y0 + x0/2 + 1/4) * e^-2x0
                const cVal = (y0 + x0/2 + 0.25) * Math.exp(-2*x0);
                cValueStr = cVal.toFixed(4);
                particularLatex = `y(x) = -\\frac{x}{2} - 0.25 + (${cValueStr}) e^{2x}`;
                solvedC = true;
            } else if (pxStr.trim() === '1/x' && qxStr.trim() === 'x') {
                // y = x^2/3 + C/x => C = (y0 - x0^2/3) * x0
                if (x0 !== 0) {
                    const cVal = (y0 - (x0*x0)/3) * x0;
                    cValueStr = cVal.toFixed(4);
                    particularLatex = `y(x) = \\frac{x^2}{3} + \\frac{${cValueStr}}{x}`;
                    solvedC = true;
                }
            }

            if (solvedC) {
                html += `
                    <div class="solution-step">
                        <h3>Paso 5: Aplicar Condición Inicial y resolver para C</h3>
                        <p>Usamos la condición inicial dada $y(${x0}) = ${y0}$:</p>
                        <p>Sustituyendo $x = ${x0}$ y $y = ${y0}$ en la solución general, encontramos el valor exacto de la constante:</p>
                        <div class="solution-step-formula">$$C = ${cValueStr}$$</div>
                        <p>Por lo tanto, la <strong>solución particular</strong> de la EDO es:</p>
                        <div class="solution-step-formula">$$${particularLatex}$$</div>
                    </div>
                `;
            } else {
                // General Numerical evaluation for initial condition
                // C = y(x0) * mu(x0) - Integral(mu*Q) evaluated at x0.
                // We'll show the formula.
                html += `
                    <div class="solution-step">
                        <h3>Paso 5: Aplicar Condición Inicial</h3>
                        <p>Evaluamos con la condición inicial dada $y(${x0}) = ${y0}$ para hallar $C$.</p>
                        <p>Sustituyendo los límites en la ecuación de la solución:</p>
                        <div class="solution-step-formula">$$${y0} = \\frac{1}{\\mu(${x0})} \\left[ \\int_{x_0}^{${x0}} \\mu(t)Q(t)\\,dt + C \\right]$$</div>
                        <p>La curva correspondiente ha sido graficada en color <strong style="color:var(--accent-cyan)">Celeste</strong> en el campo de pendientes.</p>
                    </div>
                `;
            }
        }

        solutionContainer.innerHTML = html;
        // Trigger KaTeX to render all equations
        renderMathInElement(solutionContainer);
    }

    // STEP BY STEP: SEPARABLE EDO y' = f(x) * g(y)
    function solveSeparableStepByStep(x0, y0, useIC) {
        const fxStr = inputFx.value || '1';
        const gyStr = inputGy.value || 'y';

        const fxLatex = toLatex(fxStr);
        const gyLatex = toLatex(gyStr);

        // Step 1: Separating variables
        let html = `
            <div class="solution-step">
                <h3>Paso 1: Separación de Variables</h3>
                <p>Escribimos la ecuación diferencial en términos de diferenciales $dy$ y $dx$:</p>
                <div class="solution-step-formula">$$\\frac{dy}{dx} = (${fxLatex}) \\cdot (${gyLatex})$$</div>
                <p>Agrupamos todos los términos con $y$ en el lado izquierdo y con $x$ en el lado derecho:</p>
                <div class="solution-step-formula">$$\\frac{1}{${gyLatex}} \\, dy = (${fxLatex}) \\, dx$$</div>
            </div>
        `;

        // Step 2: Integrar ambos lados
        const intFxResult = integrateSymbolic(fxStr, 'x');
        // g(y) term: We need to integrate 1/g(y). Let's check common homework functions:
        // if g(y) = y, then 1/g(y) = 1/y, integral is ln(|y|)
        // if g(y) = y^2, 1/g(y) = y^-2, integral is -1/y
        // if g(y) = 1, integral is y
        let intGyResult = null;
        let leftIntegralLatex = `\\int \\frac{1}{${gyLatex}} \\, dy`;
        let rightIntegralLatex = `\\int (${fxLatex}) \\, dx`;
        
        const gyTrim = gyStr.trim().replace(/\s+/g, '');
        if (gyTrim === 'y') {
            intGyResult = { latex: '\\ln|y|', expr: 'log(abs(y))' };
        } else if (gyTrim === 'y^2') {
            intGyResult = { latex: '-\\frac{1}{y}', expr: '-1/y' };
        } else if (gyTrim === '1') {
            intGyResult = { latex: 'y', expr: 'y' };
        }

        let intFxLatex = intFxResult ? intFxResult.latex : `\\int (${fxLatex}) \\, dx`;

        html += `
            <div class="solution-step">
                <h3>Paso 2: Integrar ambos lados de la ecuación</h3>
                <p>Aplicamos la integral a ambos lados:</p>
                <div class="solution-step-formula">$$\\int \\frac{1}{${gyLatex}} \\, dy = \\int (${fxLatex}) \\, dx + C$$</div>
        `;

        if (intGyResult && intFxResult) {
            html += `
                <p>Resolviendo las integrales obtenemos:</p>
                <div class="solution-step-formula">$$${intGyResult.latex} = ${intFxResult.latex} + C$$</div>
            </div>
            `;

            // Step 3: Solve for y explicitly (if possible)
            let explicitSolved = false;
            let explicitLatex = '';

            if (gyTrim === 'y') {
                // ln|y| = F(x) + C => y = C*e^F(x)
                explicitLatex = `y(x) = C e^{${intFxResult.latex}}`;
                explicitSolved = true;
            } else if (gyTrim === 'y^2') {
                // -1/y = F(x) + C => y = -1 / (F(x) + C)
                explicitLatex = `y(x) = \\frac{-1}{${intFxResult.latex} + C}`;
                explicitSolved = true;
            } else if (gyTrim === '1') {
                // y = F(x) + C
                explicitLatex = `y(x) = ${intFxResult.latex} + C`;
                explicitSolved = true;
            }

            if (explicitSolved) {
                html += `
                    <div class="solution-step">
                        <h3>Paso 3: Despejar la variable $y$ (Solución General Explícita)</h3>
                        <p>Despejando algebraicamente la variable $y$ obtenemos la ecuación general:</p>
                        <div class="solution-step-formula">$$${explicitLatex}$$</div>
                    </div>
                `;

                // Step 4: Particular solution
                if (useIC) {
                    let particularSolved = false;
                    let particularLatex = '';
                    let cVal = 0;

                    if (gyTrim === 'y') {
                        // y0 = C * e^F(x0) => C = y0 * e^-F(x0)
                        try {
                            const fX0 = math.evaluate(intFxResult.expr, { x: x0 });
                            cVal = y0 / Math.exp(fX0);
                            particularLatex = `y(x) = (${cVal.toFixed(4)}) e^{${intFxResult.latex}}`;
                            particularSolved = true;
                        } catch (e) {}
                    } else if (gyTrim === 'y^2') {
                        // y0 = -1 / (F(x0) + C) => C = -1/y0 - F(x0)
                        if (y0 !== 0) {
                            try {
                                const fX0 = math.evaluate(intFxResult.expr, { x: x0 });
                                cVal = -1/y0 - fX0;
                                particularLatex = `y(x) = \\frac{-1}{${intFxResult.latex} + (${cVal.toFixed(4)})}`;
                                particularSolved = true;
                            } catch(e) {}
                        }
                    } else if (gyTrim === '1') {
                        // y0 = F(x0) + C => C = y0 - F(x0)
                        try {
                            const fX0 = math.evaluate(intFxResult.expr, { x: x0 });
                            cVal = y0 - fX0;
                            particularLatex = `y(x) = ${intFxResult.latex} + (${cVal.toFixed(4)})`;
                            particularSolved = true;
                        } catch(e) {}
                    }

                    if (particularSolved) {
                        html += `
                            <div class="solution-step">
                                <h3>Paso 4: Aplicar Condición Inicial y Resolver para C</h3>
                                <p>Sustituyendo la condición inicial dada $y(${x0}) = ${y0}$:</p>
                                <p>Encontramos el valor de la constante de integración:</p>
                                <div class="solution-step-formula">$$C = ${cVal.toFixed(4)}$$</div>
                                <p>Por lo tanto, la <strong>solución particular</strong> es:</p>
                                <div class="solution-step-formula">$$${particularLatex}$$</div>
                            </div>
                        `;
                    }
                }
            }
        } else {
            html += `
                <p>Las integrales resultantes son complejas para resolverse de forma elemental:</p>
                <div class="solution-step-formula">$$\\int \\frac{1}{${gyLatex}} \\, dy = \\int (${fxLatex}) \\, dx + C$$</div>
                <div class="alert-note">
                    <strong>Nota:</strong> Los métodos de integración analítica no pudieron simplificar la expresión de forma automática. AstroDiff resolverá de manera interactiva la curva numérica y la graficará en la pantalla superior.
                </div>
            </div>
            `;
        }

        solutionContainer.innerHTML = html;
        renderMathInElement(solutionContainer);
    }

    // STEP BY STEP: GENERAL NUMERICAL EDO y' = f(x, y)
    function solveGeneralStepByStep() {
        const fxyStr = inputFxy.value || 'x - y';
        const fxyLatex = toLatex(fxyStr);

        const h = parseFloat(inputStepH.value) || 0.1;

        let html = `
            <div class="solution-step">
                <h3>Paso 1: Identificación del Método Numérico</h3>
                <p>La ecuación diferencial dada es general de primer orden:</p>
                <div class="solution-step-formula">$$y' = f(x, y) = ${fxyLatex}$$</div>
                <p>Al no seguir un patrón lineal estándar o separable simple, el sistema utiliza el algoritmo numérico de <strong>Runge-Kutta de 4to Orden (RK4)</strong> para trazar las líneas de corriente y la solución particular con una precisión de orden $\\mathcal{O}(h^4)$.</p>
            </div>
            <div class="solution-step">
                <h3>Paso 2: Fórmulas del Método RK4</h3>
                <p>Para cada paso $n$, se calculan cuatro pendientes estimadas ($k_1, k_2, k_3, k_4$) con un paso $h = ${h}$:</p>
                <div class="formula-list">
                    <div>$$k_1 = f(x_n, y_n)$$</div>
                    <div>$$k_2 = f\\left(x_n + \\frac{h}{2}, y_n + \\frac{h}{2}k_1\\right)$$</div>
                    <div>$$k_3 = f\\left(x_n + \\frac{h}{2}, y_n + \\frac{h}{2}k_2\\right)$$</div>
                    <div>$$k_4 = f(x_n + h, y_n + hk_3)$$</div>
                </div>
                <p>Y el siguiente punto se calcula como una media ponderada:</p>
                <div class="solution-step-formula">$$y_{n+1} = y_n + \\frac{h}{6}(k_1 + 2k_2 + 2k_3 + k_4)$$</div>
            </div>
            <div class="solution-step">
                <h3>Paso 3: Análisis Visual interactivo</h3>
                <p>Las curvas en el visualizador representan estas iteraciones continuas. Puedes añadir múltiples condiciones iniciales haciendo clic directamente sobre cualquier coordenada del lienzo gráfico.</p>
            </div>
        `;

        solutionContainer.innerHTML = html;
        renderMathInElement(solutionContainer);
    }

    // Paywall and Payment Interactive Logic
    let selectedPlan = 'yearly';

    function showPaywall() {
        let currentExprText = "y' = ...";
        if (currentODEType === 'linear') {
            const px = inputPx.value || 'P(x)';
            const qx = inputQx.value || 'Q(x)';
            currentExprText = `y' + (${px})y = ${qx}`;
        } else if (currentODEType === 'separable') {
            const fx = inputFx.value || 'f(x)';
            const gy = inputGy.value || 'g(y)';
            currentExprText = `y' = (${fx}) \\cdot (${gy})`;
        } else {
            const fxy = inputFxy.value || 'f(x,y)';
            currentExprText = `y' = ${fxy}`;
        }
        paywallExpression.textContent = currentExprText;
        paywallModal.classList.add('active');
    }

    function hidePaywall() {
        paywallModal.classList.remove('active');
    }

    function showPayment() {
        paymentFormStep.style.display = 'block';
        paymentProcessingStep.style.display = 'none';
        paymentSuccessStep.style.display = 'none';
        paymentModal.classList.add('active');
    }

    function hidePayment() {
        paymentModal.classList.remove('active');
    }

    btnClosePaywall.addEventListener('click', hidePaywall);
    btnMaybeLater.addEventListener('click', hidePaywall);
    btnClosePayment.addEventListener('click', hidePayment);

    btnContinuePlan.addEventListener('click', () => {
        hidePaywall();
        showPayment();
    });

    planMonthly.addEventListener('click', () => {
        planMonthly.classList.add('active');
        planYearly.classList.remove('active');
        
        planMonthly.querySelector('.radio-dot').classList.add('checked');
        planMonthly.querySelector('.radio-dot').innerHTML = '<i data-lucide="check"></i>';
        planYearly.querySelector('.radio-dot').classList.remove('checked');
        planYearly.querySelector('.radio-dot').innerHTML = '';
        lucide.createIcons();
        
        selectedPlan = 'monthly';
        btnContinuePlan.textContent = 'Continue with Monthly →';
    });

    planYearly.addEventListener('click', () => {
        planYearly.classList.add('active');
        planMonthly.classList.remove('active');
        
        planYearly.querySelector('.radio-dot').classList.add('checked');
        planYearly.querySelector('.radio-dot').innerHTML = '<i data-lucide="check"></i>';
        planMonthly.querySelector('.radio-dot').classList.remove('checked');
        planMonthly.querySelector('.radio-dot').innerHTML = '';
        lucide.createIcons();
        
        selectedPlan = 'yearly';
        btnContinuePlan.textContent = 'Continue with Yearly →';
    });

    btnSubmitPayment.addEventListener('click', () => {
        paymentFormStep.style.display = 'none';
        paymentProcessingStep.style.display = 'block';
        
        setTimeout(() => {
            paymentProcessingStep.style.display = 'none';
            paymentSuccessStep.style.display = 'block';
            isPremium = true;
            
            // Set badge to premium
            logoBadge.className = 'badge badge-premium';
            logoBadge.textContent = 'PREMIUM';
        }, 2000);
    });

    btnSuccessClose.addEventListener('click', () => {
        hidePayment();
        calculateAndDisplay(true);
    });

    // Initialize display and calculate standard defaults on load
    setupCanvas();
    calculateAndDisplay(true);
    initialLoad = false;
});
