namespace ECommerce.Entities;

public enum ActivityAction
{
    Create = 1,
    Update = 2,
    Delete = 3,

    Login = 4,
    Logout = 5,

    View = 6,
    Search = 7,

    Upload = 8,
    Download = 9,

    Approve = 10,
    Reject = 11,

    PlaceOrder = 12,
    CancelOrder = 13,

    ChangePassword = 14,
    Restore = 15,
    Archive = 16,
    Activate = 17,
    Deactivate = 18,
    Import = 19,
    Export = 20,
    Print = 21,
    Sync = 22,
    Assign = 23,

    Other = 99
}
