# coding=utf-8
from websockets.server import WebSocketServerProtocol
import weakref
import json
import asyncio
from datetime import datetime,timedelta

class USER:
    def __init__(self,id,websocket,u_count):
        websocket.USER_ID = id
        self.websocket = websocket
        self.id = id
        self.count = u_count
        self.host = websocket.host
        self.port = str(websocket.port)
        self.name = self.getDefaultName()
        self.old_name = None
        self.group = None
        self.connected_time = None
        self.disconnected_time = None

    def getDefaultName(self):
        return "游客"+str(self.count)

    async def send(self,data):
        await self.websocket.send(data)

    async def sendO(self,obj):
        await self.websocket.send(json.dumps(obj))

    def setGroup(self,group):
        self.group = weakref.ref(group)

    def dic(self):
        rs = self.__dict__.copy()
        del rs["websocket"]
        del rs["group"]
        for k in rs:
            if "Handler" in k:
                rs[k] = None
            elif isinstance(rs[k],(set,list)):
                rs[k] = [(it.dic() if hasattr(it,"dic") else it) for it in rs[k]]
            elif isinstance(rs[k],datetime):
                rs[k] = rs[k].strftime('%Y-%m-%d %H:%M:%S')
        return rs

    def minDic(self):
        return {
            "id": self.id,
            "name": self.name,
        }

    @classmethod
    def findBy(cls,websocket,inCollection):
        for u in inCollection:
            if u.id == websocket.USER_ID:
                return u
        return None

class _UserManager:
    
    def __init__(self):
        self.temp_users = set()
        self.remove_check_timer = None
        self.check_remove_user()

    def user_connected(self,user):
        user.connected_time = datetime.now()
        self.temp_users.add(user)

    def restore_user(self,user,r_user_dic):
        __tmp = None
        for temp in self.temp_users:
            if temp.id == r_user_dic["id"]:
                # 如果判断当前用户仍然在线，则不作处理。（说明同一个浏览器开了两个用户）
                if temp.disconnected_time is None or temp.disconnected_time < temp.connected_time:
                    return False
                __tmp = temp # 此处不宜直接修改user的属性，因为新连接的时候user也在这个列表中。
                break
        if __tmp is None:
            # 没有临时用户，还原用户的名字
            user.name = r_user_dic["name"]
            user.old_name = r_user_dic["old_name"]
            return False
        else:
            user.id = __tmp.id
            user.name = __tmp.name
            user.old_name = __tmp.old_name
            user.count = __tmp.count
            self.temp_users.remove(__tmp) # 因为新连接的时候已经把user注册到数组中，所以要把旧的删掉。
            return True

    def check_remove_user(self):
        try:
            REMOVE_LIST = []
            for u in self.temp_users:
                if u.disconnected_time is not None and u.disconnected_time > u.connected_time and u.disconnected_time-datetime.now() > timedelta(seconds=30):
                    REMOVE_LIST.append(u)
            for u in REMOVE_LIST:
                self.temp_users.remove(u)
        except Exception as e:
            print(e)
        asyncio.get_event_loop().call_later(2,self.check_remove_user)
        
        
    def user_disconnected(self,user):
        user.disconnected_time = datetime.now()

UserManager = _UserManager()