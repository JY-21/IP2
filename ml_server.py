from flask import Flask, request, jsonify
import joblib
import numpy as np

app = Flask(__name__)

# Try to load your trained model
try:
    model = joblib.load("random_forest_model.joblib")
    print("✅ ML model loaded successfully!")
    USE_MODEL = True
except Exception as e:
    print("⚠️ No ML model found or failed to load:", e)
    model = None
    USE_MODEL = False


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        print("📦 Received:", data)

        category = data.get("category", "General")
        urgency = data.get("urgency", "Medium")
        deadline_hours = float(data.get("deadline_hours", 24))

        # Convert text values to numeric features for model
        # use the same encoding used during training
        # Example: simple manual mapping
        category_map = {"Groceries": 0, "Work": 1, "Health": 2, "Errand": 3, "General": 4}
        urgency_map = {"Low": 0, "Medium": 1, "High": 2}

        cat_val = category_map.get(category, 4)
        urg_val = urgency_map.get(urgency, 1)

        X = np.array([[cat_val, urg_val, deadline_hours]])

        if USE_MODEL and model:
            pred = model.predict(X)[0]
            print("✅ Model Prediction:", pred)
            return jsonify({"priority": str(pred)})
        else:
            # fallback rule-based logic
            if deadline_hours < 6 or urgency == "High":
                priority = "High"
            elif deadline_hours < 24:
                priority = "Medium"
            else:
                priority = "Low"

            return jsonify({"priority": priority})

    except Exception as e:
        print("Prediction error:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
