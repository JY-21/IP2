from flask import Flask, request, jsonify
import joblib
import numpy as np
import traceback

app = Flask(__name__)

# Load the model
try:
    model_package = joblib.load('random_forest_model_fixed.joblib')
    model = model_package['model']
    le_category = model_package['le_category']
    le_urgency = model_package['le_urgency']
    le_priority = model_package['le_priority']
    print("✅ ML Model loaded successfully!")
    print("Available categories:", list(le_category.classes_))
    print("Available urgencies:", list(le_urgency.classes_))
    print("Available priorities:", list(le_priority.classes_))
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        
        category = data['category']
        deadline_hours = data['deadline_hours']
        
        # Encode inputs
        cat_enc = le_category.transform([category])[0]
        
        # Use deadline to determine effective "urgency" for prediction
        if deadline_hours < 24:
            effective_urgency = "High"
        elif deadline_hours < 72:
            effective_urgency = "Medium" 
        else:
            effective_urgency = "Low"
            
        urg_enc = le_urgency.transform([effective_urgency])[0]
        
        # Make prediction
        X_input = np.array([[cat_enc, urg_enc, deadline_hours]])
        prediction_encoded = model.predict(X_input)[0]
        priority = le_priority.inverse_transform([prediction_encoded])[0]
        
        return jsonify({
            'priority': priority,
            'category': category,
            'deadline_hours': deadline_hours
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ready' if model else 'error',
        'model_loaded': model is not None
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)