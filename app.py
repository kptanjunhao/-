# coding=utf-8
import asyncio
import json
import websockets
import action
import log
from datetime import datetime
from user import UserManager

async def counter(websocket, path):
    # register(websocket) sends user_event() to websocket
    user = await action.register(websocket)
    UserManager.user_connected(user)
    try:
        async for message in websocket:
            data = json.loads(message)
            # 打印不是绘图的数据
            if log.actionShouldLog(data["action"]):
                log.info(message)
            act = action.getMethod(data["action"])
            if act != None:
                act_args = []
                act_arg_names = act.__code__.co_varnames[:act.__code__.co_argcount]
                for n in act_arg_names:
                    act_args.append(locals()[n])
                await act(*act_args)
            else:
                print("unsupported event: {}", data)
    except websockets.exceptions.ConnectionClosedError:
        pass # 连接关闭无需处理，直接走finally移除该用户便是
    except json.decoder.JSONDecodeError as e:
        print("非JSON数据")
        print(e)
        pass
    finally:
        await action.unregister(user)
        UserManager.user_disconnected(user)
        user.websocket = None

start_server = websockets.serve(counter, "192.168.0.107", 8889)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()