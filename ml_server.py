from flask import Flask, request, jsonify
import pandas as pd
import pickle
import os

app = Flask(__name__)

# Load your trained model and encoder if they exist
try:
    model = pickle.load(open('model.pkl', 'rb'))
    encoder = pickle.load(open('encoder.pkl', 'rb'))
    model_loaded = True
    print("✅ ML Model loaded successfully")
except:
    model_loaded = False
    print("⚠️ No ML model found, using rule-based system")

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        category = data.get('category', 'General')
        urgency = data.get('urgency', 'Medium')
        deadline_hours = float(data.get('deadline_hours', 24))
        
        print(f"🎯 ML RECEIVED - Category: {category}, Urgency: {urgency}, Hours: {deadline_hours}")
        
        # ✅ SIMPLE DEADLINE-ONLY LOGIC (ignore urgency for now)
        if deadline_hours < 24:
            priority = "High"
            print("   → High priority: Less than 24 hours")
        elif deadline_hours < 72:
            priority = "Medium" 
            print("   → Medium priority: Less than 72 hours")
        else:
            priority = "Low"
            print("   → Low priority: 72+ hours")
            
        print(f"📊 FINAL PRIORITY: {priority}")
        
        return jsonify({'priority': priority})
        
    except Exception as e:
        print(f"❌ ML Error: {str(e)}")
        # Fallback - simple deadline-based
        try:
            deadline_hours = float(data.get('deadline_hours', 24))
            if deadline_hours < 24:
                return jsonify({'priority': 'High'})
            elif deadline_hours < 72:
                return jsonify({'priority': 'Medium'})
            else:
                return jsonify({'priority': 'Low'})
        except:
            return jsonify({'priority': 'Medium'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)