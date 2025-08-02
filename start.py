import requests
import time
import json
import subprocess
import sys
import atexit
import os
import signal

# Получаем путь к текущей директории
current_dir = os.path.dirname(os.path.abspath(__file__))
bot_js_path = os.path.join(current_dir, "mineflayer_bot.js")

# Запуск Node.js сервера с ботами
print(f"Запуск сервера ботов: {bot_js_path}")
node_process = None

try:
    # Запускаем с увеличенной памятью
    node_process = subprocess.Popen(
        ["node", "--max-old-space-size=4096", bot_js_path],
        stdout=sys.stdout,
        stderr=sys.stderr
    )
except Exception as e:
    print(f"Ошибка запуска Node.js: {str(e)}")
    print("Убедитесь что:")
    print("1. Node.js установлен и в PATH")
    print("2. Файл mineflayer_bot.js в этой же папке")
    sys.exit(1)

# Функция для завершения Node.js процесса при выходе
def terminate_node():
    if node_process and node_process.poll() is None:
        print("Завершение Node.js...")
        if sys.platform == "win32":
            node_process.terminate()
        else:
            os.kill(node_process.pid, signal.SIGTERM)
        try:
            node_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            print("Принудительное завершение...")
            node_process.kill()
atexit.register(terminate_node)

# Даем время серверу запуститься
print("Ожидание запуска API (10 секунд)...")
time.sleep(10)

class MinecraftBotManager:
    def __init__(self):
        self.api_url = "http://localhost:3000"
        self.bot_count = 0
    
    def create_bots(self, count):
        """Создает указанное количество ботов"""
        try:
            response = requests.post(
                f"{self.api_url}/createBots",
                json={"count": count},
                timeout=30
            )
            result = response.json()
            if result.get('status') == 'creating':
                self.bot_count = count
                print(result.get('message', ''))
                
                # Расчет времени ожидания (0.2 сек на бота + 5 сек базовых)
                wait_time = max(5, count * 0.2)
                print(f"Примерное время создания: {wait_time:.1f} секунд")
                
                # Ожидаем завершения для больших групп
                if count > 50:
                    print("Ожидайте завершения...")
                    time.sleep(wait_time)
                    
            return result
        except Exception as e:
            print(f"Ошибка: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def wait_connection(self, bot_index, timeout=60):
        """Ожидает подключения конкретного бота"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                status = self.get_bot_status(bot_index)
                if status and status.get('connected'):
                    print(f"Бот #{bot_index} подключен!")
                    return True
            except:
                pass
            print(f"Ожидание бота #{bot_index}...")
            time.sleep(3)
        return False
    
    def send_command(self, endpoint, data=None):
        """Отправляет команду API"""
        try:
            url = f"{self.api_url}/{endpoint}"
            if data:
                response = requests.post(url, json=data, timeout=15)
            else:
                response = requests.get(url, timeout=15)
            return response.json()
        except Exception as e:
            print(f"Ошибка API: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def chat(self, bot_index, message):
        """Отправляет сообщение от имени бота"""
        return self.send_command("chat", {
            "botIndex": bot_index,
            "message": message
        })
    
    def broadcast(self, message):
        """Отправляет сообщение от всех ботов"""
        return self.send_command("broadcast", {
            "message": message
        })
    
    def move_to(self, bot_index, x, y, z):
        """Двигает бота к указанным координатам"""
        return self.send_command("move", {
            "botIndex": bot_index,
            "x": x,
            "y": y,
            "z": z
        })
    
    def stop_bot(self, bot_index):
        """Останавливает движение бота"""
        return self.send_command("stop", {
            "botIndex": bot_index
        })
    
    def get_all_status(self):
        """Возвращает статус всех ботов"""
        try:
            response = requests.get(f"{self.api_url}/status", timeout=15)
            return response.json()
        except Exception as e:
            print(f"Ошибка получения статуса: {str(e)}")
            return []
    
    def get_bot_status(self, bot_index):
        """Возвращает статус конкретного бота"""
        statuses = self.get_all_status()
        if bot_index < len(statuses):
            return statuses[bot_index]
        return None

def print_bot_status(status):
    """Выводит статус бота в читаемом формате"""
    if not status:
        print("Статус недоступен")
        return
    
    print(f"Бот: {status.get('username', '?')}")
    print(f"Подключен: {'Да' if status.get('connected') else 'Нет'}")
    print(f"Движется: {'Да' if status.get('isMoving') else 'Нет'}")
    
    pos = status.get('position')
    if pos:
        print(f"Позиция: X={pos['x']:.1f}, Y={pos['y']:.1f}, Z={pos['z']:.1f}")
    
    print(f"Здоровье: {status.get('health', '?')}")
    print(f"Сытость: {status.get('food', '?')}")

if __name__ == "__main__":
    manager = MinecraftBotManager()
    
    # Создаем ботов
    try:
        count = int(input("Сколько ботов создать? (1-1000): ") or 1)
        count = max(min(count, 1000), 1)
        result = manager.create_bots(count)
        
        # Дополнительное ожидание для больших групп
        if count > 100:
            wait_time = max(10, count * 0.15)
            print(f"Дополнительное ожидание {wait_time:.1f} сек...")
            time.sleep(wait_time)
    except ValueError:
        print("Ошибка ввода, создаю 1 бота")
        manager.create_bots(1)
    
    # Главное меню управления
    while True:
        print("\nУправление ботами:")
        print("1. Отправить сообщение (один бот)")
        print("2. Отправить сообщение (все боты)")
        print("3. Переместить бота")
        print("4. Остановить бота")
        print("5. Проверить статус бота")
        print("6. Проверить статус всех ботов")
        print("7. Выход")
        
        choice = input("Выберите действие (1-7): ")
        
        if choice == "1":
            try:
                bot_index = int(input("Индекс бота: "))
                message = input("Сообщение: ")
                result = manager.chat(bot_index, message)
                print("Результат:", result)
            except Exception as e:
                print(f"Ошибка: {str(e)}")
            
        elif choice == "2":
            message = input("Сообщение для всех: ")
            result = manager.broadcast(message)
            print("Результат:", result)
            
        elif choice == "3":
            try:
                bot_index = int(input("Индекс бота: "))
                x = float(input("X: "))
                y = float(input("Y: "))
                z = float(input("Z: "))
                result = manager.move_to(bot_index, x, y, z)
                print("Результат:", result)
            except:
                print("Ошибка ввода координат")
                
        elif choice == "4":
            try:
                bot_index = int(input("Индекс бота: "))
                result = manager.stop_bot(bot_index)
                print("Результат:", result)
            except:
                print("Ошибка ввода индекса")
                
        elif choice == "5":
            try:
                bot_index = int(input("Индекс бота: "))
                status = manager.get_bot_status(bot_index)
                print("\nСтатус бота:")
                print_bot_status(status)
            except:
                print("Ошибка ввода индекса")
            
        elif choice == "6":
            print("\nСтатус всех ботов:")
            statuses = manager.get_all_status()
            for i, status in enumerate(statuses):
                print(f"\nБот #{i}:")
                print_bot_status(status)
                
        elif choice == "7":
            print("Завершение работы...")
            break
            
        else:
            print("Некорректный выбор")