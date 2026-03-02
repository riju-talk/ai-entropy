import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Award, BookOpen, Globe, Users, MessageSquare, Sparkles, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2">About entropy</h1>
                <p className="text-muted-foreground text-lg">Revolutionizing academic collaboration since 2024</p>
              </div>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              entropy is a comprehensive platform designed for students, educators, and researchers to collaborate,
              share knowledge, and solve academic challenges together.
            </p>
          </div>
        </section>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <MessageSquare className="h-12 w-12 text-primary" />
            </div>
            <div className="text-3xl font-bold mb-2">12,847</div>
            <div className="text-muted-foreground">Questions Asked</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Users className="h-12 w-12 text-primary" />
            </div>
            <div className="text-3xl font-bold mb-2">2,156</div>
            <div className="text-muted-foreground">Active Users</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Award className="h-12 w-12 text-primary" />
            </div>
            <div className="text-3xl font-bold mb-2">234</div>
            <div className="text-muted-foreground">Resolved Today</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <TrendingUp className="h-12 w-12 text-primary" />
            </div>
            <div className="text-3xl font-bold mb-2">React</div>
            <div className="text-muted-foreground">Trending Topic</div>
          </div>
        </div>

        {/* Features Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose entropy?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="p-8 text-center">
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Ask & Answer</h3>
                <p className="text-muted-foreground">
                  Post questions, get answers from experts, and help others with their academic challenges.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-8 text-center">
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">AI Assistant</h3>
                <p className="text-muted-foreground">
                  Get instant help from Athena, our intelligent AI assistant powered by advanced language models.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-8 text-center">
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Community</h3>
                <p className="text-muted-foreground">
                  Connect with students and educators worldwide through our vibrant academic community.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Mission Section */}
        <section className="mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
            <p className="text-lg text-muted-foreground mb-8">
              To democratize access to quality education by connecting learners with knowledge,
              fostering collaboration, and leveraging AI to make learning more accessible and effective for everyone.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="text-center">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Global Access</h3>
                <p className="text-sm text-muted-foreground">Education without borders</p>
              </div>
              <div className="text-center">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Quality Content</h3>
                <p className="text-sm text-muted-foreground">Expert-verified knowledge</p>
              </div>
              <div className="text-center">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Community Driven</h3>
                <p className="text-sm text-muted-foreground">Built by learners, for learners</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-12">
              <h2 className="text-3xl font-bold mb-4">Ready to Join entropy?</h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                Start your learning journey today and become part of a global community of curious minds.
              </p>
              <div className="flex gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link href="/ask">
                    Ask Your First Question
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/ai-agent">
                    Try Athena AI
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}

// Sample data
const timelineEvents = [
  {
    year: "1965",
    description:
      "Founded as the International Institute for Advanced Studies with a mission to foster global cooperation through education.",
  },
  {
    year: "1978",
    description:
      "Expanded to include four faculties: Sciences, Humanities, Business, and Social Sciences. Established the first international exchange programs.",
  },
  {
    year: "1992",
    description:
      "Granted full university status and renamed as Global University. Opened the first international campus in Singapore.",
  },
  {
    year: "2005",
    description:
      "Launched the Global Research Initiative, connecting researchers across continents to address pressing world challenges.",
  },
  {
    year: "2015",
    description:
      "Celebrated 50 years of academic excellence with the opening of the Innovation Center and expanded digital learning platforms.",
  },
  {
    year: "Present",
    description:
      "Operating across five continents with over 15,000 students from 120+ countries, continuing our mission of global education and research.",
  },
]

const executiveTeam = [
  {
    name: "Dr. Elena Rodriguez",
    title: "President",
    bio: "Dr. Rodriguez has led Global University since 2018. With a background in International Relations and Higher Education Leadership, she has strengthened the university's global partnerships and innovative programs.",
    image: "/placeholder.svg?height=400&width=300",
  },
  {
    name: "Prof. Kwame Osei",
    title: "Provost & Vice President for Academic Affairs",
    bio: "Prof. Osei oversees all academic programs and faculty affairs. His expertise in comparative education systems has been instrumental in developing our globally-relevant curriculum.",
    image: "/placeholder.svg?height=400&width=300",
  },
  {
    name: "Dr. Min-Jun Park",
    title: "Vice President for Research & Innovation",
    bio: "Dr. Park leads the university's research initiatives and innovation ecosystem. His background in interdisciplinary research has fostered collaboration across traditional academic boundaries.",
    image: "/placeholder.svg?height=400&width=300",
  },
]

const deans = [
  {
    name: "Prof. Sarah Chen",
    title: "Dean, Faculty of Science & Technology",
    bio: "Prof. Chen is an award-winning computer scientist specializing in artificial intelligence and its ethical applications. She leads the faculty's initiatives in sustainable technology development.",
    image: "/placeholder.svg?height=400&width=300",
  },
  {
    name: "Dr. Ahmed Hassan",
    title: "Dean, Faculty of Humanities & Arts",
    bio: "Dr. Hassan brings expertise in comparative literature and cultural studies. Under his leadership, the faculty has expanded its focus on digital humanities and global cultural exchange.",
    image: "/placeholder.svg?height=400&width=300",
  },
  {
    name: "Prof. Isabella Rossi",
    title: "Dean, Faculty of Business & Economics",
    bio: "Prof. Rossi's background in sustainable business practices and international finance guides the faculty's emphasis on responsible leadership and global economic systems.",
    image: "/placeholder.svg?height=400&width=300",
  },
]

const boardMembers = [
  {
    name: "Mr. Rajiv Mehta",
    title: "Chairperson, Board of Trustees",
    bio: "Mr. Mehta brings 30 years of experience in international business and philanthropy. He has been instrumental in expanding the university's global partnerships and financial sustainability.",
    image: "/placeholder.svg?height=400&width=300",
  },
  {
    name: "Dr. Fatima Al-Mansoori",
    title: "Vice Chair, Board of Trustees",
    bio: "Dr. Al-Mansoori is a renowned physician and public health advocate who guides the university's health sciences initiatives and community engagement programs.",
    image: "/placeholder.svg?height=400&width=300",
  },
  {
    name: "Ms. Gabriela Santos",
    title: "Trustee",
    bio: "Ms. Santos is a technology entrepreneur whose expertise in digital innovation has supported the university's advancement in online education and digital infrastructure.",
    image: "/placeholder.svg?height=400&width=300",
  },
]

const campuses = [
  {
    id: "main",
    name: "Main Campus - Global City",
    description:
      "Our flagship campus features state-of-the-art facilities, sustainable architecture, and vibrant community spaces across 200 acres.",
    image: "/placeholder.svg?height=400&width=600",
  },
  {
    id: "asia",
    name: "Asia Pacific Campus - Singapore",
    description:
      "Located in the heart of Singapore's education district, this campus specializes in business, technology, and Asian studies programs.",
    image: "/placeholder.svg?height=400&width=600",
  },
  {
    id: "europe",
    name: "European Campus - Barcelona",
    description:
      "Set in historic Barcelona, this campus offers programs in arts, humanities, and Mediterranean studies in a culturally rich environment.",
    image: "/placeholder.svg?height=400&width=600",
  },
]
