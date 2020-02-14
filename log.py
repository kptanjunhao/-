# coding=utf-8

NO_LOG_ACTION = [
    "postReady",
    "getGroupList",
    "restoreUser",
    "postState",
]


def info(*args):
    print(*args)



def actionShouldLog(action):
    return action not in NO_LOG_ACTION