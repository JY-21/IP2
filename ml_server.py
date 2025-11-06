from flask import Flask, request, jsonify
import joblib

app = Flask(__name__)

# Load model and encoders
try:
    package = joblib.load("random_forest_model.joblib")
    model = package['model']
    le_category = package['le_category']
    le_urgency = package['le_urgency']
    le_priority = package['le_priority']
    print("✅ ML model and encoders loaded successfully!")
except Exception as e:
    print("⚠️ Model package not found, using fallback rules:", e)
    model = None

@app.route("/predict", methods=["POST"])
def predict_priority():
    data = request.get_json()
    print("📦 Incoming:", data)

    category = data.get("category", "Others")
    urgency = data.get("urgency", "Medium")
    deadline_hours = float(data.get("deadline_hours", 24))

    # Handle missing encoders gracefully
    if model is None:
        # Simple rule fallback
        if urgency == "High" or deadline_hours < 24:
            return jsonify({"priority": "High"})
        elif urgency == "Medium" or deadline_hours < 72:
            return jsonify({"priority": "Medium"})
        else:
            return jsonify({"priority": "Low"})

    # Encode category and urgency for model
    try:
        cat_enc = le_category.transform([category])[0]
    except ValueError:
        cat_enc = le_category.transform(["Others"])[0]

    try:
        urg_enc = le_urgency.transform([urgency])[0]
    except ValueError:
        urg_enc = le_urgency.transform(["Medium"])[0]

    # Predict using RandomForest
    X = [[cat_enc, urg_enc, deadline_hours]]
    pred_enc = model.predict(X)[0]
    priority = le_priority.inverse_transform([pred_enc])[0]

    print(f"✅ Prediction: {priority}")
    return jsonify({"priority": priority})

if __name__ == "__main__":
    app.run(debug=True)
