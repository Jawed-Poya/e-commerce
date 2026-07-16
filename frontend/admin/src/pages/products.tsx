import {
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Badge } from "@/components/ui/badge";
import { useProducts } from "@/features/products/hooks/use-products";
import { useNavigate } from "react-router-dom";

export default function ProductsPage() {
    const navigate = useNavigate();
    const { data } = useProducts();

    return (
        <div className="space-y-6">
            <div
                className="
                flex
                items-center
                justify-between
            "
            >
                <div>
                    <h1
                        className="
                        text-2xl
                        font-bold
                    "
                    >
                        Products
                    </h1>

                    <p
                        className="
                        text-sm
                        text-muted-foreground
                    "
                    >
                        Manage your store products
                    </p>
                </div>

                <Button
                    className={"cursor-pointer"}
                    onClick={() => navigate("/products/new")}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                </Button>
            </div>

            {/* Toolbar */}
            <div
                className="
                        mb-4
                        flex
                        items-center
                        gap-3
                    "
            >
                <div
                    className="
                            relative
                            flex-1
                        "
                >
                    <Search
                        className="
                                absolute
                                left-3
                                top-2.5
                                h-4
                                w-4
                                text-muted-foreground
                            "
                    />

                    <Input
                        placeholder="Search products..."
                        className="
                                    pl-9
                                "
                    />
                </div>

                <Button variant="outline">Filter</Button>
            </div>

            {/* Table */}
            <div
                className="
                        rounded-md
                        border
                    "
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>

                            <TableHead>SKU</TableHead>

                            <TableHead>Category</TableHead>

                            <TableHead>Price</TableHead>

                            <TableHead>Stock</TableHead>

                            <TableHead>Status</TableHead>

                            <TableHead
                                className="
                                        text-right
                                    "
                            >
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {data?.data?.map((product) => (
                            <TableRow key={product.id}>
                                <TableCell
                                    className="
                                            font-medium
                                        "
                                >
                                    {product.name}
                                </TableCell>

                                <TableCell>{product.sku}</TableCell>

                                <TableCell>{product.category}</TableCell>

                                <TableCell>{product.price}</TableCell>

                                <TableCell>
                                    <Badge
                                        variant={
                                            product.stock > 0
                                                ? "outline"
                                                : "destructive"
                                        }
                                    >
                                        {product.stock}
                                    </Badge>
                                </TableCell>

                                <TableCell>
                                    <Badge>
                                        {product.status ? "Active" : "Inactive"}
                                    </Badge>
                                </TableCell>

                                <TableCell
                                    className="
                                            text-right
                                        "
                                >
                                    <DropdownMenu>
                                        <DropdownMenuTrigger>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>

                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem>
                                                <Eye className="mr-2 h-4 w-4" />
                                                View
                                            </DropdownMenuItem>

                                            <DropdownMenuItem>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                className="
                                                            text-destructive
                                                        "
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
