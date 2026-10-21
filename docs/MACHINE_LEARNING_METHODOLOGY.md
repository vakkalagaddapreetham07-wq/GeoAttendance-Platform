# Machine Learning Methodology & Anomaly Detection Specification
## Geofence-Based Attendance Management System

---

## 1. Mathematical Foundation: Isolation Forest

The system implements the **Isolation Forest** unsupervised anomaly detection algorithm formulated by *Fei Tony Liu, Kai Ming Ting, and Zhi-Hua Zhou (2008)*.

Unlike profiling techniques that model normal data clusters, Isolation Forest explicitly isolates anomalies. Anomalies possess two quantitative characteristics:
1. They are few in number (minority distribution).
2. They possess attribute-values distinct from typical instances.

Consequently, in recursive binary tree partitioning (Isolation Trees / iTrees), anomalous points are isolated closer to the root of the tree with significantly shorter path lengths than normal observations.

### 1.1 Path Length & Average Search Cost

For a dataset of subsample size $n$, the average path length of unsuccessful searches in a Binary Search Tree (BST) represents the equivalent random tree height:

$$c(n) = 2 \left( \ln(n - 1) + \gamma \right) - \frac{2(n - 1)}{n}$$

Where $\gamma \approx 0.5772156649$ is the Euler-Mascheroni constant.

### 1.2 Anomaly Score Formulation

Given an ensemble of $t$ isolation trees, the path length $h(x)$ of an observation $x$ yields expected path length $E(h(x))$. The normalized anomaly score $s(x, n)$ is:

$$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$

- When $E(h(x)) \to 0$, $s \to 1$ (High likelihood of anomaly).
- When $E(h(x)) \to n - 1$, $s \to 0$ (Normal observation).
- When $E(h(x)) \to c(n)$, $s \to 0.5$ (Indeterminate / benchmark threshold).

In this system, contamination is configured at $\alpha = 0.10$ ($10\%$).

---

## 2. Required Four-Feature Attendance Vector

The backend and ML microservice strictly calculate and evaluate the four features required by the SRS:

| # | Feature Name | Unit | Mathematical Definition | Interpretation |
|---|---|---|---|---|
| **1** | `check_in_deviation` | Minutes | $T_{\text{in}} - T_{\text{shift\_start}}$ | Positive = Late arrival; Negative = Early arrival |
| **2** | `check_out_deviation` | Minutes | $T_{\text{out}} - T_{\text{shift\_end}}$ | Positive = Overtime departure; Negative = Early exit |
| **3** | `geofence_duration` | Minutes | $\frac{T_{\text{out}} - T_{\text{in}}}{60000}$ | Total continuous minutes recorded within geofence |
| **4** | `distance_from_center` | Metres | $d_{\text{Haversine}}(P_{\text{device}}, P_{\text{center}})$ | Great-circle distance from designated office center |

### Feature Order Integrity
Training and real-time inference use the strict, identical vector order:
`[check_in_deviation, check_out_deviation, geofence_duration, distance_from_center]`

---

## 3. Independent Hard-Rule Fallback Engine

Independent deterministic rules run alongside the ML model:

1. **Short Stay / Buddy Punch Rule (SRS Specification)**:
   $$\text{geofence\_duration} < 30 \text{ minutes} \implies \text{VIOLATION}$$
2. **Perimeter Breach Rule**:
   $$\text{distance\_from\_center} > 50.0 \text{ metres} \implies \text{VIOLATION}$$
3. **Extreme Unexcused Delay**:
   $$\text{check\_in\_deviation} > 240 \text{ minutes (4 hours)} \implies \text{VIOLATION}$$

A hard-rule violation triggers an anomaly flag **regardless of ML output**. If the Python ML service is unreachable, hard-rule checks evaluate independently without interruption.

---

## 4. Combined Arbitration Matrix

The system classifies every completed attendance session into one of four mutually exclusive detection sources:

| ML Isolation Forest | Hard-Rule Engine | Detection Source Assigned | Explanation Stored |
|---|---|---|---|
| Flagged ($s \ge 0.55$) | Violated | `both` | Flagged by both ML Model and Deterministic Rules |
| Flagged ($s \ge 0.55$) | Passed | `ml_only` | Multi-dimensional behavioral deviation identified by ML |
| Normal ($s < 0.55$) | Violated | `hard_rule_only` | Policy violation caught by deterministic threshold |
| Normal ($s < 0.55$) | Passed | `none` | Normal attendance within acceptable bounds |

---

## 5. Synthetic Dataset Generation & Evaluation

Because historical enterprise attendance telemetry was unavailable at initialization (cold start), a reproducible dataset of $2,500$ records was generated (`ml-service/training/synthetic_attendance_dataset.csv`):
- $2,200$ Normal records ($88\%$): On-time arrivals ($\pm 15$m), standard duration ($540 \pm 30$m), within 50m geofence.
- $300$ Anomalous records ($12\%$): Short stays (10–25m), ghost departures, boundary GPS anomalies, extreme delays.

### Evaluation Metrics Achieved (on 2,500 Ground Truth Records)
- **Total Records Evaluated**: $2,500$
- **Accuracy**: $98.00\%$
- **Precision**: $100.00\%$
- **Recall**: $83.33\%$
- **F1-Score**: $90.91\%$
- **Confusion Matrix**:
  - True Positives (Anomalies caught): $250$
  - False Positives (Normal flagged): $0$
  - True Negatives (Normal passed): $2,200$
  - False Negatives (Anomalies missed): $50$

---

## 6. Academic Limitations & Ethics Notice

1. **Limitation of Synthetic Data**: While synthetic datasets allow rigorous cold-start validation of algorithmic behavior, actual human attendance distributions exhibit unmodeled seasonalities, weather-induced GPS multipath reflections, and emergency building movements.
2. **Non-Punitive Adjudication**: System predictions serve as risk indicators for HR administrative review rather than automated evidence of employee misconduct.
3. **Approved Leave Exclusion**: Employees with approved leave requests are excluded from absence anomaly scoring to prevent false-positive penalization.
