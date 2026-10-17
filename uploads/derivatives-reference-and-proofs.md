# Derivatives of Elementary Functions

Reference Table and Proofs

<!-- Source: page 1 -->

Page header: ELEMENTARY FUNCTIONS — Derivatives and Proofs.

## 1 Derivative reference table

All trigonometric angles are measured in **radians**.

| Function $f(x)$ | Derivative $f'(x)$ | Domain or conditions |
|---|---|---|
| Constant $C$ | $0$ | $x\in\mathbb R$ |
| $x^\alpha$ | $\alpha x^{\alpha-1}$ | For arbitrary real $\alpha$, first take $x>0$ |
| $e^x$ | $e^x$ | $x\in\mathbb R$ |
| $a^x$ | $a^x\ln a$ | $a>0$, $a\ne1$ |
| $\ln x$ | $1/x$ | $x>0$ |
| $\log_a x$ | $1/(x\ln a)$ | $x>0$, $a>0$, $a\ne1$ |
| $\sin x$ | $\cos x$ | $x\in\mathbb R$ |
| $\cos x$ | $-\sin x$ | $x\in\mathbb R$ |
| $\tan x$ | $\sec^2x=1/\cos^2x$ | $\cos x\ne0$ |
| $\cot x$ | $-\csc^2x=-1/\sin^2x$ | $\sin x\ne0$ |
| $\sec x$ | $\sec x\tan x$ | $\cos x\ne0$ |
| $\csc x$ | $-\csc x\cot x$ | $\sin x\ne0$ |

**A note on powers.** For positive integer powers, the formula holds for every real $x$. Negative integer powers require $x\ne0$. For other powers, behavior at zero or at negative inputs must be checked for the particular function.

Differentiation finds a function's **instantaneous rate of change** at a point. Every derivative formula ultimately comes from the same definition:
$$f'(x)=\lim_{h\to0}\frac{f(x+h)-f(x)}h.$$

<!-- Source: page 2 -->

## 2 The four differentiation rules

Suppose $u=u(x)$ and $v=v(x)$ are differentiable, and $a,b$ are constants:
$$\begin{aligned}
(au+bv)'&=au'+bv',\\
(uv)'&=u'v+uv',\\
\left(\frac uv\right)'&=\frac{u'v-uv'}{v^2}\quad(v\ne0),\\
[f(g(x))]'&=f'(g(x))g'(x).
\end{aligned}$$

The last rule is the **chain rule**: differentiate the outer function with respect to its input, then multiply by the derivative of the inner function. For example,
$$ (\sin x^2)'=\cos(x^2)\cdot2x.$$

### Why these rules hold

**Linearity** follows directly from the sum and constant-multiple rules for limits.

**Product rule.** The key is to split the simultaneous changes in the two factors:
$$\begin{aligned}
u(x+h)v(x+h)-u(x)v(x)
&=[u(x+h)-u(x)]v(x+h)\\
&\quad+u(x)[v(x+h)-v(x)].
\end{aligned}$$
Divide by $h$ and let $h\to0$. Since differentiability implies continuity,
$$ (uv)'=u'v+uv'.$$

**Chain rule.** An equivalent formulation of differentiability gives a rigorous proof. Let $\Delta u=g(x+h)-g(x)$. Then
$$\Delta u=g'(x)h+o(h),$$
while the change in the outer function is
$$f(g(x)+\Delta u)-f(g(x))=f'(g(x))\Delta u+o(\Delta u).$$
Here $o(h)$ denotes an error that is negligible compared with $h$ as $h\to0$. Substitute, divide by $h$, and take the limit:
$$[f(g(x))]'=f'(g(x))g'(x).$$

**Quotient rule.** First differentiate the reciprocal:
$$\left(\frac1v\right)'=\lim_{h\to0}\frac{v(x)-v(x+h)}{h\,v(x+h)v(x)}=-\frac{v'}{v^2}.$$
Now write $u/v=u\cdot(1/v)$ and apply the product rule.

<!-- Source: page 3 -->

## 3 Constants and powers: proofs

### 3.1 Constants

A constant does not change, so
$$ (C)'=\lim_{h\to0}\frac{C-C}h=0.$$

### 3.2 Positive integer powers

Use the binomial expansion:
$$ (x+h)^n=x^n+nx^{n-1}h+\binom n2x^{n-2}h^2+\cdots+h^n.$$
Thus,
$$\frac{(x+h)^n-x^n}h=nx^{n-1}+\binom n2x^{n-2}h+\cdots+h^{n-1}.$$
As $h\to0$, every term still containing $h$ tends to zero, leaving
$$ (x^n)'=nx^{n-1}.$$
The proof for arbitrary real powers follows after exponentials and logarithms.

## 4 Logarithms and exponentials: proofs

Start with the familiar limit definition
$$e=\lim_{n\to\infty}\left(1+\frac1n\right)^n.$$

### 4.1 Natural logarithms

Fix $x>0$. Set $n=x/h$, so $h=x/n$:
$$\begin{aligned}
(\ln x)'&=\lim_{h\to0}\frac{\ln(x+h)-\ln x}h\\
&=\lim_{h\to0}\frac{\ln(1+h/x)}h\\
&=\frac1x\lim_{|n|\to\infty}n\ln\left(1+\frac1n\right)\\
&=\frac1x\ln\left[\lim_{|n|\to\infty}\left(1+\frac1n\right)^n\right]\\
&=\frac1x\ln e=\frac1x.
\end{aligned}$$
The same defining limit gives $e$ as $n\to-\infty$, so this works from either side. The change-of-base formula gives
$$\log_a x=\frac{\ln x}{\ln a},\qquad (\log_a x)'=\frac1{x\ln a}.$$

<!-- Source: page 4 -->

Page header: ELEMENTARY FUNCTIONS — Derivatives and Proofs.

### 4.2 Natural exponentials

Let $t=e^h-1$. As $h\to0$, we have $t\to0$ and $h=\ln(1+t)$. Therefore,
$$\lim_{h\to0}\frac{e^h-1}h=\lim_{t\to0}\frac t{\ln(1+t)}=1.$$
The last limit is the reciprocal of the derivative of $\ln x$ at $x=1$. Substitute into the definition of the derivative:
$$\begin{aligned}
(e^x)'&=\lim_{h\to0}\frac{e^{x+h}-e^x}h\\
&=e^x\lim_{h\to0}\frac{e^h-1}h=e^x.
\end{aligned}$$
Since $a^x=e^{x\ln a}$, the chain rule gives
$$ (a^x)'=a^x\ln a.$$

### 4.3 Arbitrary real powers

For $x>0$,
$$x^\alpha=e^{\alpha\ln x}.$$
Therefore,
$$ (x^\alpha)'=e^{\alpha\ln x}\cdot\frac\alpha x=\alpha x^{\alpha-1}.$$
Here $\alpha$ must be a **constant**. For example, in $x^x$ the exponent also varies, so the power rule cannot be applied directly.

<!-- Source: page 5 -->

## 5 Trigonometric functions: proofs

First establish two limits:
$$\lim_{h\to0}\frac{\sin h}h=1,\qquad\lim_{h\to0}\frac{\cos h-1}h=0.$$
For the first, compare areas in the unit circle. When $0<h<\pi/2$,
$$\sin h<h<\tan h\quad\Longrightarrow\quad\cos h<\frac{\sin h}h<1.$$
The squeeze theorem gives a right-hand limit of $1$. Since $\sin h/h$ is even, the left-hand limit is also $1$.

For the second limit, multiply by $1+\cos h$ on the top and bottom:
$$\frac{\cos h-1}h=-\frac{\sin^2h}{h(1+\cos h)}=-\frac{\sin h}h\cdot\frac{\sin h}{1+\cos h}\longrightarrow-1\cdot\frac0{1+1}=0.$$
Here we just use $\sin h\to0$ and $\cos h\to1$ as $h\to0$.

### 5.1 Sine and cosine

Use the angle-addition formula and the same algebraic rearrangement:
$$\begin{aligned}
(\sin x)'&=\lim_{h\to0}\frac{\sin x\cos h+\cos x\sin h-\sin x}h\\
&=\lim_{h\to0}\frac{\sin h}h\left(\cos x-\sin x\frac{\sin h}{1+\cos h}\right)\\
&=1\left(\cos x-\sin x\frac0{1+1}\right)=\cos x.
\end{aligned}$$
Similarly,
$$\begin{aligned}
(\cos x)'&=\lim_{h\to0}\frac{\cos x\cos h-\sin x\sin h-\cos x}h\\
&=\lim_{h\to0}\frac{\sin h}h\left(-\sin x-\cos x\frac{\sin h}{1+\cos h}\right)\\
&=1\left(-\sin x-\cos x\frac0{1+1}\right)=-\sin x.
\end{aligned}$$

### 5.2 The other four trigonometric functions

Write each as a ratio or reciprocal of sine and cosine, then differentiate:
$$\begin{aligned}
(\tan x)'&=\left(\frac{\sin x}{\cos x}\right)'=\frac{\cos^2x+\sin^2x}{\cos^2x}=\sec^2x,\\
(\cot x)'&=\left(\frac{\cos x}{\sin x}\right)'=\frac{-\sin^2x-\cos^2x}{\sin^2x}=-\csc^2x,\\
(\sec x)'&=\left(\frac1{\cos x}\right)'=\frac{\sin x}{\cos^2x}=\sec x\tan x,\\
(\csc x)'&=\left(\frac1{\sin x}\right)'=-\frac{\cos x}{\sin^2x}=-\csc x\cot x.
\end{aligned}$$

<!-- Source: page 6 -->

## 6 What is easiest to overlook in practice?

**When $x$ in a formula is replaced by a function, multiply by the derivative of that inner function.**

For example,
$$[(3x+1)^5]'=5(3x+1)^4\cdot3,$$
$$[\ln(1+x^2)]'=\frac{2x}{1+x^2},$$
$$[e^{-x^2}]'=-2xe^{-x^2}.$$

Also distinguish these three similar-looking functions:
$$\begin{aligned}
(x^a)'&=ax^{a-1},\\
(a^x)'&=a^x\ln a,\\
(x^x)'&=x^x(\ln x+1)\quad(x>0).
\end{aligned}$$
For the last formula, write $x^x=e^{x\ln x}$ and differentiate.

**First identify whether the base, the exponent, or both are changing; then choose the formula.**

<!-- Source: page 7 -->

Page header: ELEMENTARY FUNCTIONS — Derivatives and Proofs.

## 7 Practice Exercises

**Source:** Joel Hass, Christopher Heil, and Maurice D. Weir, *Thomas' Calculus*, 14th edition, Pearson, 2018. ISBN 978-0-13-443898-6. References below use the book's printed page numbers.

Find the first derivative of each function with respect to its independent variable. Each answer follows its question; no working is included.

1. Source: Section 3.3, Exercise 17, p. 121.
   $$y=\frac{2x+5}{3x-2}\qquad\left[\frac{dy}{dx}=-\frac{19}{(3x-2)^2}\right]$$
2. Source: Section 3.3, Exercise 19, p. 121.
   $$g(x)=\frac{x^2-4}{x+0.5}\qquad\left[g'(x)=\frac{x^2+x+4}{(x+0.5)^2}\right]$$
3. Source: Section 3.5, Exercise 3, p. 138.
   $$y=x^2\cos x\qquad\left[\frac{dy}{dx}=2x\cos x-x^2\sin x\right]$$
4. Source: Section 3.5, Exercise 7, p. 138.
   $$f(x)=\sin x\tan x\qquad[f'(x)=\cos x\tan x+\sin x\sec^2x]$$
5. Source: Section 3.5, Exercise 12, p. 138.
   $$y=\frac{\cos x}{1+\sin x}\qquad\left[\frac{dy}{dx}=-\frac1{1+\sin x}\right]$$

<!-- Source: page 8 -->

6. Source: Section 3.6, Exercise 19, p. 145.
   $$p=\sqrt{3-t}\qquad\left[\frac{dp}{dt}=-\frac1{2\sqrt{3-t}}\right]$$
7. Source: Section 3.6, Exercise 29, p. 145.
   $$y=(4x+3)^4(x+1)^{-3}\qquad\left[\frac{dy}{dx}=\frac{(4x+3)^3(4x+7)}{(x+1)^4}\right]$$
8. Source: Section 3.6, Exercise 34, p. 145.
   $$g(x)=\frac{\tan3x}{(x+7)^4}\qquad\left[g'(x)=\frac{3(x+7)\sec^2(3x)-4\tan(3x)}{(x+7)^5}\right]$$
9. Source: Section 7.2, Exercise 17, p. 385.
   $$y=t(\ln t)^2\qquad\left[\frac{dy}{dt}=(\ln t)^2+2\ln t\right]$$
10. Source: Section 7.2, Exercise 25, p. 385.
    $$y=\ln(\ln x)\qquad\left[\frac{dy}{dx}=\frac1{x\ln x}\right]$$

<!-- Source: page 9 -->

11. Source: Section 7.3, Exercise 75, p. 395.
    $$y=x^3\log_{10}x\qquad\left[\frac{dy}{dx}=3x^2\log_{10}x+\frac{x^2}{\ln10}\right]$$
12. Source: Section 7.3, Exercise 7, p. 394.
    $$y=e^{-5x}\qquad\left[\frac{dy}{dx}=-5e^{-5x}\right]$$
13. Source: Section 7.3, Exercise 13, p. 394.
    $$y=(x^2-2x+2)e^x\qquad\left[\frac{dy}{dx}=x^2e^x\right]$$
14. Source: Section 7.3, Exercise 17, p. 394.
    $$y=\cos\left(e^{-u^2}\right)\qquad\left[\frac{dy}{du}=2ue^{-u^2}\sin\left(e^{-u^2}\right)\right]$$
15. Source: Section 7.3, Exercise 69, p. 395.
    $$y=2^{\sin3t}\qquad\left[\frac{dy}{dt}=3(\ln2)2^{\sin3t}\cos3t\right]$$
