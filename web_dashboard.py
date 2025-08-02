from flask import Flask, render_template
import requests
import threading
import time
from datetime import datetime

app = Flask(__name__)
app.config['API_URL'] = "http://localhost:3000"

# Кэш для хранения данных
bot_data_cache = []
performance_cache = {}
last_update = 0
cpu_history = []
ram_history = []
max_history = 20

def update_data():
    """Фоновая задача для обновления данных"""
    global bot_data_cache, performance_cache, last_update, cpu_history, ram_history
    
    while True:
        try:
            # Получаем данные о ботах
            response = requests.get(f"{app.config['API_URL']}/status", timeout=5)
            if response.status_code == 200:
                bot_data_cache = response.json()
            
            # Получаем данные о производительности
            response = requests.get(f"{app.config['API_URL']}/performance", timeout=5)
            if response.status_code == 200:
                performance_data = response.json()
                performance_cache = performance_data
                
                # Обновляем историю для графиков
                cpu_history.append(performance_data.get('cpu', 0))
                ram_history.append(performance_data.get('ram', 0))
                
                if len(cpu_history) > max_history:
                    cpu_history.pop(0)
                if len(ram_history) > max_history:
                    ram_history.pop(0)
            
            last_update = time.time()
        except Exception as e:
            print(f"Ошибка обновления данных: {str(e)}")
        
        time.sleep(3)

# Фильтр для преобразования timestamp
@app.template_filter('timestamp_to_time')
def timestamp_to_time_filter(timestamp):
    if not timestamp:
        return "Никогда"
    return datetime.fromtimestamp(timestamp).strftime('%H:%M:%S')

@app.route('/')
def dashboard():
    """Главная страница с информацией о ботах"""
    return render_template(
        'dashboard.html',
        bots=bot_data_cache,
        performance=performance_cache,
        last_update=last_update,
        cpu_history=cpu_history,
        ram_history=ram_history
    )

@app.route('/bot/<int:bot_id>')
def bot_detail(bot_id):
    """Страница с детальной информацией о боте"""
    bot = next((b for b in bot_data_cache if b['botIndex'] == bot_id), None)
    return render_template('bot_detail.html', bot=bot)

@app.route('/performance-data')
def performance_data():
    """Endpoint для получения данных о производительности"""
    return {
        'performance': performance_cache,
        'cpu_history': cpu_history,
        'ram_history': ram_history
    }

if __name__ == '__main__':
    # Запускаем фоновое обновление данных
    threading.Thread(target=update_data, daemon=True).start()
    app.run(port=5000, debug=True)