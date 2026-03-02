"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    name: string | null;
    bio: string | null;
    university: string | null;
    course: string | null;
    year: number | null;
    image: string | null;
  };
  onUpdate: () => void;
}

export function EditProfileModal({
  open,
  onOpenChange,
  user,
  onUpdate,
}: EditProfileModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name || "",
    bio: user.bio || "",
    university: user.university || "",
    course: user.course || "",
    year: user.year?.toString() || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/users/me/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          year: formData.year ? parseInt(formData.year) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      toast({
        title: "Success!",
        description: "Your profile has been updated successfully",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] sm:max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Edit Profile</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Update your profile information. Your profile picture is managed by
            your account provider.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 py-3 sm:py-4">
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="name" className="text-sm">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="text-sm sm:text-base"
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="bio" className="text-sm">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              rows={4}
              className="text-sm sm:text-base resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="university" className="text-sm">University</Label>
              <Input
                id="university"
                type="text"
                placeholder="Your university"
                value={formData.university}
                onChange={(e) =>
                  setFormData({ ...formData, university: e.target.value })
                }
                className="text-sm sm:text-base"
              />
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="course" className="text-sm">Course/Major</Label>
              <Input
                id="course"
                type="text"
                placeholder="e.g., Computer Science"
                value={formData.course}
                onChange={(e) =>
                  setFormData({ ...formData, course: e.target.value })
                }
                className="text-sm sm:text-base"
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="year" className="text-sm">Year of Study</Label>
            <Select
              value={formData.year}
              onValueChange={(value) =>
                setFormData({ ...formData, year: value })
              }
            >
              <SelectTrigger id="year" className="text-sm sm:text-base">
                <SelectValue placeholder="Select your year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1st Year</SelectItem>
                <SelectItem value="2">2nd Year</SelectItem>
                <SelectItem value="3">3rd Year</SelectItem>
                <SelectItem value="4">4th Year</SelectItem>
                <SelectItem value="5">5th Year</SelectItem>
                <SelectItem value="6">Postgraduate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto order-1 sm:order-2">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  <span className="text-sm">Saving...</span>
                </>
              ) : (
                <span className="text-sm">Save Changes</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
