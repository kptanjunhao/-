# coding=utf-8
import json
import asyncio
import uuid
from datetime import datetime
from group import Group,BaseGroup
from user import UserManager,USER

IDPOOL = 0
SERVER_START_TIME = datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def get_pool_id():
    global IDPOOL
    IDPOOL += 1
    return str(uuid.uuid4()).replace('-','')

def user_event(user):
    return json.dumps({"user":user.dic(),"server":{"startTime":SERVER_START_TIME}})

async def register(websocket):
    user = USER(get_pool_id(),websocket,IDPOOL)
    await websocket.send(user_event(user))
    await BaseGroup.userEnter(user)
    user.setGroup(BaseGroup)
    await websocket.send(json.dumps({"users":[user.dic() for user in BaseGroup.users],}))
    return user

async def restoreUser(user,data):
    restoreData = json.loads(data["data"])
    if "server" in restoreData:
        if restoreData["server"]["startTime"] == SERVER_START_TIME:
            if UserManager.restore_user(user,restoreData["user"]):
                # 把缓存的临时用户返回，通知浏览器修改当前用户的信息
                await user.send(user_event(user))
                # 把用户的群组返回回去，通知浏览器修改群组
                await user.send(user.group().group_event())

async def unregister(user):
    if user.group() != BaseGroup:
        await user.group().userLeave(user)
    await BaseGroup.userLeave(user)


async def sendError(user,msg):
    await user.sendO({"errMSG":{"msg":msg}})

async def postReady(user):
    await user.group().ready(user)

async def getGroupList(user):
    await user.send(Group.group_list_event_all())

async def postAddGroup(user):
    group = Group(get_pool_id(),user)
    Group.append(group)
    # 通知当前用户进入房间
    await group.userEnter(user)
    await user.send(group.group_event())
    # 通知大厅用户有新房间创建了
    await BaseGroup.notify_all(Group.group_list_event_all())

async def postBackGroup(user):
    await BaseGroup.userEnter(user)
    await user.send(BaseGroup.group_event())

async def enterGroup(user,data):
    group = Group.getBy(data["id"])
    if group != None:
        if group.isStart:
            # 游戏已经开始。不能进入了。
            await sendError(user,"该房间已开始游戏!")
        else:
            await group.userEnter(user)
            await user.send(group.group_event())
    else:
        await sendError(user,"该房间已解散。")

async def postChangeTitle(user,data):
    await user.group().changeTitle(user)

async def postMessage(user,data):
        await user.group().sendMessage(user,data["message"])

async def setName(user,data):
    user.old_name = user.name
    user.name = data["name"]
    await user.group().userSetName(user)

async def postState(user,data):
    if user.group() != BaseGroup:
        await user.group().sendState(user.id,data["state"])

async def postClearState(user,data):
    if user.group() != BaseGroup:
        await user.group().clearState(user)

def getMethod(name):
    ATTRS = globals()
    if name in ATTRS:
        return ATTRS[name]
    else:
        return None
