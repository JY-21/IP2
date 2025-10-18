from flask import Flask, request, jsonify
import joblib
import numpy as np

app = Flask(__name__)

# Load model and encoders
model = joblib.load("task_priority_model.joblib")
le_category = joblib.load("le_category.joblib")
le_urgency = joblib.load("le_urgency.joblib")
le_priority = joblib.load("le_priority.joblib")

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        category = data.get("category", "General")
        urgency = data.get("urgency", "Medium")
        deadline_hours = data.get("deadline_hours", 24)

        #Convert to DataFrame with proper feature names
        import pandas as pd
        input_data = pd.DataFrame([[
            category, urgency, deadline_hours
        ]], columns=['category','urgency', 'deadline_hours']) 

        if urgency == "High" or deadline_hours < 24:
            priority = "High"
        elif urgency == "Medium" or deadline_hours < 72:
            priority = "Medium"
        else:
            priority = "Low"

        #make prediction
        prediction = model.predict(input_encoded)
        probability = model.predict_proba(input_encoded)

        priority_map = {0: 'Low', 1: 'Medium', 2: 'High'}
        predicted_priority = priority_map[prediction[0]]

        # ✅ Check if all required fields exist
        if category is None or urgency is None or deadline_hours is None:
            return jsonify({"error": "Missing required fields (category, urgency, deadline_hours)"}), 400

        # Encode
        category_enc = le_category.transform([category])[0]
        urgency_enc = le_urgency.transform([urgency])[0]

        # ✅ Ensure all 3 features are passed to model
        X = np.array([[category_enc, urgency_enc, float(deadline_hours)]])

        pred = model.predict(X)
        priority_label = le_priority.inverse_transform(pred)[0]

        return jsonify({"priority": priority_label})

    except Exception as e:
        print("Prediction error:", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
